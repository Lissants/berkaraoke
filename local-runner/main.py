import os
import json
import tempfile
import subprocess
import sys  # Added for sys.exit()
from math import log2, sqrt
import numpy as np
from appwrite.client import Client
from appwrite.services.storage import Storage
from appwrite.services.databases import Databases
from scipy.io import wavfile
from dotenv import load_dotenv
from appwrite.query import Query
import datetime
from crepe import predict as crepe_predict

# Load environment variables early
load_dotenv('endpoints.env')

# Standard note frequency table
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

def check_ffmpeg():
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        print("FFmpeg is available")
        return True
    except Exception as e:
        print("FFmpeg check failed. Please install FFmpeg and add it to your PATH")
        print(f"Error: {str(e)}")
        return False

if not check_ffmpeg():
    sys.exit(1)

def generate_note_frequencies():
    return {f"{note}{octave}": round(16.35 * (2 ** ((i + (octave * 12)) / 12)), 2)
            for octave in range(0, 9) for i, note in enumerate(NOTE_NAMES)}

NOTE_FREQUENCIES = generate_note_frequencies()

def frequency_to_note(freq):
    return min(NOTE_FREQUENCIES.items(), key=lambda x: abs(x[1] - freq))[0] if freq > 0 else None

def convert_audio_to_wav(input_path, output_path):
    try:
        input_path = os.path.abspath(input_path)
        output_path = os.path.abspath(output_path)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        cmd = ['ffmpeg', '-y', '-i', input_path, '-acodec', 'pcm_s16le', '-ac', '1', '-ar', '44100', output_path]
        if os.name == 'nt':
            cmd = f'ffmpeg -y -i "{input_path}" -acodec pcm_s16le -ac 1 -ar 44100 "{output_path}"'
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        else:
            result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0 or not os.path.exists(output_path):
            raise Exception(result.stderr or "Output file not created")
        return True
    except Exception as e:
        print(f"Conversion failed: {str(e)}")
        if os.path.exists(input_path):
            os.remove(input_path)
        if os.path.exists(output_path):
            os.remove(output_path)
        return False

def download_and_process_audio(storage, file_id):
    try:
        temp_dir = os.path.join(os.environ.get('TEMP', os.getcwd()), 'karaoke_temp')
        os.makedirs(temp_dir, exist_ok=True)
        
        input_path = os.path.join(temp_dir, f"{file_id}.m4a")
        output_path = os.path.join(temp_dir, f"{file_id}.wav")

        # Download file
        file_content = storage.get_file_download(os.getenv('APPWRITE_STORAGE_ID'), file_id)
        with open(input_path, 'wb') as f:
            f.write(file_content)

        # Convert and process
        if not convert_audio_to_wav(input_path, output_path):
            raise Exception("Audio conversion failed")
            
        sr, audio = wavfile.read(output_path)
        time, frequency, confidence, _ = crepe_predict(audio, sr, model_capacity='tiny', viterbi=True)
        
        # Clean up
        os.remove(input_path)
        os.remove(output_path)
        
        return time, frequency, confidence
    except Exception as e:
        print(f"Error processing {file_id}: {str(e)}")
        if 'input_path' in locals() and os.path.exists(input_path):
            os.remove(input_path)
        if 'output_path' in locals() and os.path.exists(output_path):
            os.remove(output_path)
        raise

def calculate_performance(frequencies, confidences):
    valid_freqs = frequencies[confidences > 0.5]
    return {frequency_to_note(freq): 1 - 12 * abs(log2(freq/NOTE_FREQUENCIES[frequency_to_note(freq)]))
            for freq in valid_freqs if frequency_to_note(freq)}

def process_recordings(databases, storage, document_ids):
    combined_performance = {}
    processed_files = []
    
    for doc_id in document_ids:
        try:
            doc = databases.get_document(
                os.getenv('APPWRITE_DB_ID'),
                os.getenv('APPWRITE_USER_TRACKS_COLLECTION_ID'),
                doc_id
            )
            
            if not doc.get('fileIds'):
                continue
                
            file_id = doc['fileIds'][0]
            time, frequency, confidence = download_and_process_audio(storage, file_id)
            performance = calculate_performance(frequency, confidence)
            
            for note, score in performance.items():
                combined_performance[note] = (combined_performance.get(note, 0) + score) / 2
                
            processed_files.append(file_id)
        except Exception as e:
            print(f"Error processing {doc_id}: {str(e)}")
            
    return combined_performance, processed_files

def generate_recommendations(tracks, performance):
    recommendations = []
    for track in tracks:
        try:
            
            print(f"Generating recommendations from {len(tracks)} tracks")
            print(f"User performance metrics: {len(performance)} notes")
            
            # Handle different note data formats
            notes_data = track.get('notesBinary', {})
            
            # Case 1: Already a dictionary
            if isinstance(notes_data, dict):
                binary_notes = notes_data
            # Case 2: JSON string
            elif isinstance(notes_data, str):
                binary_notes = json.loads(notes_data)
            # Case 3: List format
            elif isinstance(notes_data, list):
                binary_notes = {note: 1 for note in notes_data}
            else:
                binary_notes = {}
            
            # Calculate similarity
            valid_notes = [note for note in binary_notes if binary_notes.get(note) == 1]
            if not valid_notes:
                continue
                
            distance = sqrt(sum((1 - performance.get(note, 0))**2 for note in valid_notes)) / len(valid_notes)
            
            recommendations.append({
                'id': track['$id'],
                'songName': track['songName'],
                'artist': track['artist'],
                'similarity': 1 - distance,
                'genre': track['genre']
            })
            
        except Exception as e:
            print(f"Error processing track {track.get('$id')}: {str(e)}")
            continue
    
    return sorted(recommendations, key=lambda x: x['similarity'], reverse=True)[:5]

def main(context):
    document_id = master_doc_id = None
    
    try:
        # Initialize Appwrite client
        client = Client()
        client.set_endpoint(os.getenv('APPWRITE_ENDPOINT'))
        client.set_project(os.getenv('APPWRITE_PROJECT_ID')) 
        client.set_key(os.getenv('APPWRITE_API_KEY'))
        
        databases = Databases(client)
        storage = Storage(client)

        # Parse request
        data = json.loads(context.req.body)
        document_id = data['documentId']
        master_doc_id = data.get('masterDocumentId', document_id)
        document_ids = data.get('documentIds', [document_id])
        file_ids = data.get('fileIds', [])
        
        # Verify document exists
        doc = databases.get_document(
            os.getenv('APPWRITE_DB_ID'),
            os.getenv('APPWRITE_USER_TRACKS_COLLECTION_ID'),
            document_id
        )
        
        # Update status
        databases.update_document(
            os.getenv('APPWRITE_DB_ID'),
            os.getenv('APPWRITE_USER_TRACKS_COLLECTION_ID'),
            document_id,
            {'processingStatus': 'processing'}
        )
        
        # Process audio
        combined_performance, processed_files = process_recordings(databases, storage, document_ids)
        
        # Process standalone files
        for file_id in file_ids:
            try:
                time, frequency, confidence = download_and_process_audio(storage, file_id)
                performance = calculate_performance(frequency, confidence)
                for note, score in performance.items():
                    combined_performance[note] = (combined_performance.get(note, 0) + score) / 2
                processed_files.append(file_id)
            except Exception as e:
                print(f"Error processing {file_id}: {str(e)}")
        
        # Get recommendations
        queries = [
            q for q in [
                Query.equal('genre', data['genreFilter']) if data.get('genreFilter') != 'all' else None,
                Query.equal('artist', data['artistFilter']) if data.get('artistFilter') != 'all' else None
            ] if q
        ]
        
        karaoke_tracks = databases.list_documents(
            os.getenv('APPWRITE_DB_ID'),
            os.getenv('APPWRITE_KARAOKE_COLLECTION_ID'),
            queries=queries
        ).get('documents', [])
        
        top_recommendations = generate_recommendations(karaoke_tracks, combined_performance)
        
        # Save results
        result = {
            'processingStatus': 'completed',
            'recommendations': [json.dumps(top_recommendations)],
            'performanceData': [json.dumps({
                'strongNotes': dict(sorted(combined_performance.items(), key=lambda x: x[1], reverse=True)[:5]),
                'weakNotes': dict(sorted(combined_performance.items(), key=lambda x: x[1])[:5]),
                'overallAccuracy': np.mean(list(combined_performance.values())) if combined_performance else 0
            })],
            'crepeAnalysis': f"Processed {len(processed_files)} recordings",
            'accuracyScore': int((np.mean(list(combined_performance.values())) * 100) if combined_performance else 0),
            'processedAt': datetime.datetime.now().isoformat(),
            'childDocuments': document_ids
        }
        
        databases.update_document(
            os.getenv('APPWRITE_DB_ID'),
            os.getenv('APPWRITE_USER_TRACKS_COLLECTION_ID'),
            master_doc_id,
            result
        )
        
        return context.res.json({
            'success': True,
            'message': 'Processing completed',
            'processedFiles': processed_files,
            'masterDocumentId': master_doc_id
        })
        
    except Exception as e:
        error_data = {
            'processingStatus': 'failed',
            'error': str(e),
            'failedAt': datetime.datetime.now().isoformat()
        }
        
        try:
            if document_id:
                databases.update_document(
                    os.getenv('APPWRITE_DB_ID'),
                    os.getenv('APPWRITE_USER_TRACKS_COLLECTION_ID'),
                    document_id,
                    error_data
                )
            if master_doc_id and master_doc_id != document_id:
                databases.update_document(
                    os.getenv('APPWRITE_DB_ID'),
                    os.getenv('APPWRITE_USER_TRACKS_COLLECTION_ID'),
                    master_doc_id,
                    error_data
                )
        except Exception as update_err:
            print(f"Failed to update error status: {str(update_err)}")
        
        return context.res.json({
            'success': False,
            'error': str(e)
        }, 500)