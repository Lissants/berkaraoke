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
    "documentIds": ["680330680039f415b5d0"],  # Your actual document ID
    "masterDocumentId": "680330680039f415b5d0",  # Same if no master doc
    "documentId": "680330680039f415b5d0",  # Must match existing doc
    "userId": "67e3b3e7001038db86c2",  # Full user ID
    "fileIds": ["68032f9100355cc72876"],  # Your actual file ID
    "genreFilter": "all",
    "artistFilter": "all"
    }
    
    context = ContextMock()
    context.req.body = json.dumps(test_event)  # Direct stringify
    
    try:
        main(context)
    except Exception as e:
        print(f"Execution failed: {str(e)}")