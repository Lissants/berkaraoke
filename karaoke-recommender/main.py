import os
import json
import tempfile
import subprocess
from math import log2, sqrt
import numpy as np
from appwrite.client import Client
from appwrite.services.storage import Storage
from appwrite.services.databases import Databases
import crepe
from scipy.io import wavfile

# Standard note frequency table
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

def generate_note_frequencies():
    note_frequencies = {}
    base_frequency = 16.35  # Frequency of C0
    for octave in range(0, 9):  # Octaves 0 through 8
        for i, note in enumerate(NOTE_NAMES):
            n = i + (octave * 12)  # Offset by semitone index
            frequency = base_frequency * (2 ** (n / 12))
            note_name = f"{note}{octave}"
            note_frequencies[note_name] = round(frequency, 2)
    return note_frequencies

NOTE_FREQUENCIES = generate_note_frequencies()

def frequency_to_note(freq):
    if freq <= 0:
        return None
    min_diff = float('inf')
    closest_note = None
    for note, standard_freq in NOTE_FREQUENCIES.items():
        diff = abs(freq - standard_freq)
        if diff < min_diff:
            min_diff = diff
            closest_note = note
    return closest_note

def convert_audio_to_wav(input_path, output_path):
    try:
        subprocess.run([
            'ffmpeg', '-y', '-i', input_path,
            '-acodec', 'pcm_s16le', '-ac', '1', '-ar', '44100',
            output_path
        ], check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"FFmpeg conversion failed: {e}")
        return False

def process_audio(file_path):
    sr, audio = wavfile.read(file_path)
    time, frequency, confidence, _ = crepe.predict(
        audio, sr,
        model_capacity=os.getenv('CREPE_MODEL_CAPACITY', 'medium'),
        viterbi=True
    )
    return time, frequency, confidence

def calculate_performance(frequencies, confidences):
    performance = {}
    valid_indices = confidences > 0.5
    valid_freqs = frequencies[valid_indices]
    
    for freq in valid_freqs:
        note = frequency_to_note(freq)
        if note:
            standard_freq = NOTE_FREQUENCIES[note]
            accuracy = 1 - 12 * abs(log2(freq / standard_freq))
            if note in performance:
                performance[note] = (performance[note] + accuracy) / 2
            else:
                performance[note] = accuracy
    return performance

def main(context):
    try:
        # Initialize Appwrite client
        client = Client()
        client.set_endpoint(os.getenv('APPWRITE_ENDPOINT'))
        client.set_project(os.getenv('APPWRITE_PROJECT_ID'))
        client.set_key(os.getenv('APPWRITE_API_KEY'))
        
        databases = Databases(client)
        storage = Storage(client)
        
        # Parse event data
        data = json.loads(context.req.body)
        file_ids = data.get('fileIds', [])
        user_id = data.get('userId')
        document_id = data.get('documentId')
        genre_filter = data.get('genreFilter', 'all')
        artist_filter = data.get('artistFilter', 'all')
        
        # Update status to processing
        databases.update_document(
            os.getenv('APPWRITE_DB_ID'),
            os.getenv('APPWRITE_USER_TRACKS_COLLECTION_ID'),
            document_id,
            {'processingStatus': 'processing'}
        )
        
        # Process all recordings
        combined_performance = {}
        for file_id in file_ids:
            try:
                # Download audio file
                file_content = storage.get_file_download(
                    os.getenv('APPWRITE_STORAGE_ID'),
                    file_id
                )
                
                with tempfile.NamedTemporaryFile(suffix='.m4a') as tmp_input, \
                     tempfile.NamedTemporaryFile(suffix='.wav') as tmp_wav:
                    
                    # Write downloaded content
                    tmp_input.write(file_content)
                    tmp_input.flush()
                    
                    # Convert to WAV
                    if not convert_audio_to_wav(tmp_input.name, tmp_wav.name):
                        continue
                    
                    # Process with CREPE
                    time, frequency, confidence = process_audio(tmp_wav.name)
                    
                    # Calculate performance
                    performance = calculate_performance(frequency, confidence)
                    
                    # Combine performances
                    for note, score in performance.items():
                        if note in combined_performance:
                            combined_performance[note] = (combined_performance[note] + score) / 2
                        else:
                            combined_performance[note] = score
            
            except Exception as e:
                print(f"Error processing file {file_id}: {str(e)}")
                continue
        
        # Get filtered karaoke tracks
        queries = []
        if genre_filter and genre_filter.lower() != 'all':
            queries.append(Query.equal('genre', genre_filter))
        if artist_filter and artist_filter.lower() != 'all':
            queries.append(Query.equal('artist', artist_filter))
        
        karaoke_tracks = databases.list_documents(
            os.getenv('APPWRITE_DB_ID'),
            os.getenv('APPWRITE_KARAOKE_COLLECTION_ID'),
            queries=queries
        ).get('documents', [])
        
        # Generate recommendations
        recommendations = []
        for track in karaoke_tracks:
            try:
                binary_notes = json.loads(track.get('notesBinary', '{}'))
                distances = []
                total_notes = 0
                
                for note in binary_notes:
                    if binary_notes[note] == 1:
                        user_score = combined_performance.get(note, 0)
                        distances.append((1 - user_score) ** 2)
                        total_notes += 1
                
                if total_notes > 0:
                    distance = sqrt(sum(distances)) / total_notes
                    similarity = 1 - distance
                    recommendations.append({
                        'id': track['$id'],
                        'songName': track['songName'],
                        'artist': track['artist'],
                        'similarity': similarity,
                        'genre': track['genre']
                    })
            
            except Exception as e:
                print(f"Error processing track {track.get('$id')}: {str(e)}")
                continue
        
        # Sort and get top 5
        top_recommendations = sorted(recommendations, key=lambda x: x['similarity'], reverse=True)[:5]
        
        # Prepare results
        result = {
            'processingStatus': 'completed',
            'recommendations': [json.dumps(top_recommendations)],
            'performanceData': [json.dumps({
                'strongNotes': dict(sorted(combined_performance.items(), 
                                       key=lambda x: x[1], reverse=True)[:5]),
                'weakNotes': dict(sorted(combined_performance.items(), 
                                      key=lambda x: x[1])[:5]),
                'overallAccuracy': np.mean(list(combined_performance.values())) 
                                   if combined_performance else 0
            })],
            'crepeAnalysis': f"Processed {len(file_ids)} recordings with average confidence",
            'accuracyScore': int(np.mean(list(combined_performance.values())) * 100 if combined_performance else 0),
            'processedAt': datetime.datetime.now().isoformat()
        }
        
        # Save results
        databases.update_document(
            os.getenv('APPWRITE_DB_ID'),
            os.getenv('APPWRITE_USER_TRACKS_COLLECTION_ID'),
            document_id,
            result
        )
        
        return context.res.json({
            'success': True,
            'message': 'Processing completed successfully'
        })
    
    except Exception as e:
        print(f"Error in main function: {str(e)}")
        if 'document_id' in locals():
            databases.update_document(
                os.getenv('APPWRITE_DB_ID'),
                os.getenv('APPWRITE_USER_TRACKS_COLLECTION_ID'),
                document_id,
                {
                    'processingStatus': 'failed',
                    'error': str(e)
                }
            )
        return context.res.json({
            'success': False,
            'error': str(e)
        }, 500)