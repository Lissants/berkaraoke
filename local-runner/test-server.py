from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return "Hello World! This is working!", 200

@app.route('/api')
def api():
    return jsonify({"status": "success", "message": "API is working"})

if __name__ == '__main__':
    print("Server starting at http://localhost:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)