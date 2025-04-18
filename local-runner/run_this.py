from main import main  
from dotenv import load_dotenv
import json

load_dotenv('endpoints.env')

class ContextMock:
    def __init__(self):
        self.req = RequestMock()
        self.res = ResponseMock()
        self.log = print

class RequestMock:
    body = '{}'
    headers = {}
    
class ResponseMock:
    def json(self, data, status_code=200):
        print(f"Response ({status_code}):", data)
        return data

if __name__ == "__main__":
    # Flat structure - no nested "body"
    test_event = {
    "documentIds": ["68022625001f8a444d4d"],  # Your actual document ID
    "masterDocumentId": "68022625001f8a444d4d",  # Same if no master doc
    "documentId": "68022625001f8a444d4d",  # Must match existing doc
    "userId": "67d06f1d001c5d0eaf42",  # Full user ID
    "fileIds": ["6802262400024023ba8f"],  # Your actual file ID
    "genreFilter": "pop",
    "artistFilter": "all"
    }
    
    context = ContextMock()
    context.req.body = json.dumps(test_event)  # Direct stringify
    
    try:
        main(context)
    except Exception as e:
        print(f"Execution failed: {str(e)}")