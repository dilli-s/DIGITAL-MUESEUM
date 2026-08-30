import pytest
from app import create_app
from app.config import Config
import os

class TestConfig(Config):
    TESTING = True
    # Using the real DB as requested in the prompt, but we could use a separate test db if needed
    DATABASE_URL = os.environ.get('DATABASE_URL')

@pytest.fixture
def app():
    app = create_app(config_class=TestConfig)
    yield app

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def db(app):
    from app.utils.db import get_db_connection, execute_query
    
    # We can add setup/teardown logic here for the DB if needed
    yield execute_query
