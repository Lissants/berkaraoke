from flask import Flask, request, jsonify
from flask_cors import CORS
import threading
import os
from dotenv import load_dotenv
from main import main as process_audio
import warnings
import json
import sys
import subprocess

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3' 
warnings.filterwarnings('ignore')

load_dotenv('endpoints.env')

app = Flask(__name__)
CORS(app)

@app.route('/')
def health_check():
    return jsonify({"status": "ready"})

@app.route('/process', methods=['POST'])
def handle_processing():
    try:
        if not request.is_json:
            return jsonify({"error": "Request must be JSON"}), 400
            
        data = request.get_json()
        print("Received data:", data)
        
        # Validate required fields
        if not all(field in data for field in ['fileIds', 'documentId', 'userId']):
            return jsonify({"error": "Missing required fields"}), 400

        # Create temp request file
        import tempfile
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as tmp:
            json.dump(data, tmp)
            tmp_path = tmp.name
        
        # Launch processor
        subprocess.Popen([
            sys.executable, 
            'processor.py',
            data['documentId'],
            tmp_path  # Pass temp file path
        ])
        
        return jsonify({"status": "started"}), 202
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("\n=== Server Running (Production Mode) ===")
    app.run(
        host='0.0.0.0', 
        port=5000,
        debug=False,  # Disable debug mode
        use_reloader=False  # Disable auto-reloader
    )