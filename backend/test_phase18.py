import requests

BASE_URL = 'http://127.0.0.1:5000/api'
session = requests.Session()

def test():
    print("Logging in...")
    # Using the user created in previous test
    res = session.post(f"{BASE_URL}/auth/login", json={
        "email": "test_activity@example.com",
        "password": "password123"
    })
    print(res.status_code, res.json())
    
    print("Testing Recommendations API...")
    res = session.get(f"{BASE_URL}/recommendations")
    print(res.status_code, res.json())
    
    print("Testing AI Assistant API...")
    # This might fail gracefully if AI_API_KEY is not set
    res = session.post(f"{BASE_URL}/ai/ask", json={
        "question": "What ancient objects do you have?"
    })
    print(res.status_code, res.json())

if __name__ == '__main__':
    test()
