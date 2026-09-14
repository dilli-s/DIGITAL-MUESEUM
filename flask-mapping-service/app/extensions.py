from psycopg2 import pool
import logging

# We will initialize this pool in the application factory
db_pool = None
_database_url = None

def init_db_pool(app=None, dsn=None):
    global db_pool, _database_url
    if app and 'DATABASE_URL' in app.config:
        _database_url = app.config['DATABASE_URL']
    elif dsn:
        _database_url = dsn

    if not _database_url:
        raise ValueError(
            "DATABASE_URL is not configured. Set it in flask-mapping-service/.env "
            "to a local PostgreSQL connection string, for example: "
            "postgresql://USER:PASSWORD@127.0.0.1:5432/DATABASE"
        )

    try:
        if db_pool is not None:
            try:
                db_pool.closeall()
            except Exception:
                pass

        db_pool = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=10,
            dsn=_database_url,
            keepalives=1,
            keepalives_idle=30,
            keepalives_interval=10,
            keepalives_count=5
        )
        if db_pool:
            logging.info("Connection pool created successfully with TCP keepalives")
    except Exception as e:
        logging.error(f"Error creating connection pool: {e}")
        raise

def reinit_db_pool():
    """Safely recreate the connection pool after severe socket drop or pool exhaustion."""
    global db_pool, _database_url
    logging.warning("Re-initializing database connection pool...")
    init_db_pool(dsn=_database_url)
