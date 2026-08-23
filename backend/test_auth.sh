#!/bin/bash
echo "1. Register test user"
curl -s -c cookies.txt -X POST http://127.0.0.1:5000/api/auth/register -H "Content-Type: application/json" -d '{"name": "Test User", "email": "test@example.com", "password": "testpassword"}'
echo -e "\n\n2. Duplicate user test"
curl -s -c cookies.txt -X POST http://127.0.0.1:5000/api/auth/register -H "Content-Type: application/json" -d '{"name": "Test User", "email": "test@example.com", "password": "testpassword"}'
echo -e "\n\n3. Login test (success)"
curl -s -b cookies.txt -c cookies.txt -X POST http://127.0.0.1:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "test@example.com", "password": "testpassword"}'
echo -e "\n\n4. Auth status test (success)"
curl -s -b cookies.txt -X GET http://127.0.0.1:5000/api/auth/me
echo -e "\n\n5. Protected route test (success)"
curl -s -b cookies.txt -X GET http://127.0.0.1:5000/api/auth/test-protected
echo -e "\n\n6. Logout"
curl -s -b cookies.txt -c cookies.txt -X POST http://127.0.0.1:5000/api/auth/logout
echo -e "\n\n7. Auth status test (fail)"
curl -s -b cookies.txt -X GET http://127.0.0.1:5000/api/auth/me
echo -e "\n\n8. Protected route test (fail)"
curl -s -b cookies.txt -X GET http://127.0.0.1:5000/api/auth/test-protected
echo -e "\n\n9. Login test (fail)"
curl -s -X POST http://127.0.0.1:5000/api/auth/login -H "Content-Type: application/json" -d '{"email": "test@example.com", "password": "wrongpassword"}'
