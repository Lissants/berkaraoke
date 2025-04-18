from flask import Flask, request, jsonify
from main import main
import threading
import json

app = Flask(__name__)

class ContextMock:
    def __init__(self, body):
        self.req = RequestMock(body)
        self.res = ResponseMock()
        
class RequestMock:
    def __init__(self, body):
        self.body = json.dumps(body)
        self.headers = {}
        
class ResponseMock:
    def json(self, data, status_code=200):
        return {'status_code': status_code, 'data': data}

@app.route('/process', methods=['POST'])
def process_audio():
    try:
        data = request.json
        context = ContextMock(data)
        
        # Run processing in a separate thread to avoid blocking
        def run_processing():
            main(context)
            
        thread = threading.Thread(target=run_processing)
        thread.start()
        
        return jsonify({
            'success': True,
            'message': 'Processing started',
            'documentId': data.get('documentId')
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, threaded=True)