import requests

BASE_URL = 'http://127.0.0.1:5000/api'
session = requests.Session()

def test():
    # Register and login
    print("Registering...")
    res = session.post(f"{BASE_URL}/auth/register", json={
        "email": "test_activity@example.com",
        "name": "Test User",
        "password": "password123"
    })
    
    if res.status_code == 409:
        print("User already exists, logging in...")
    
    print("Logging in...")
    res = session.post(f"{BASE_URL}/auth/login", json={
        "email": "test_activity@example.com",
        "password": "password123"
    })
    print(res.status_code, res.json())
    
    # Bookmark
    print("Bookmarking object 1...")
    res = session.post(f"{BASE_URL}/bookmarks/", json={
        "content_type": "object",
        "content_id": 1
    })
    print(res.status_code, res.json())
    
    # Get bookmarks
    print("Getting bookmarks...")
    res = session.get(f"{BASE_URL}/bookmarks/")
    print(res.status_code, res.json())
    
    # Update Learning Progress
    print("Updating learning progress...")
    res = session.post(f"{BASE_URL}/progress/learning/1", json={"progress": 100})
    print(res.status_code, res.json())
    
    # Complete Activity
    print("Completing activity...")
    res = session.post(f"{BASE_URL}/activities/1/complete", json={})
    print(res.status_code, res.json())
    
    # Get History
    print("Getting history...")
    res = session.get(f"{BASE_URL}/history/")
    print(res.status_code, res.json())

if __name__ == '__main__':
    test()
