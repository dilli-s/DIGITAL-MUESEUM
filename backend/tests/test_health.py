import unittest
from app import create_app

class HealthTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config.update({
            "TESTING": True,
        })
        self.client = self.app.test_client()

    def test_health_endpoint(self):
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json, {"status": "ok"})

if __name__ == '__main__':
    unittest.main()
