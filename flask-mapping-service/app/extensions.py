from psycopg2 import pool
import logging

# We will initialize this pool in the application factory
db_pool = None

def init_db_pool(app):
    global db_pool
    try:
        db_pool = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=app.config['DATABASE_URL']
        )
        if db_pool:
            logging.info("Connection pool created successfully")
    except Exception as e:
        logging.error(f"Error creating connection pool: {e}")
        raise
