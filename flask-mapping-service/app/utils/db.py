from contextlib import contextmanager
from app import extensions
import logging

@contextmanager
def get_db_connection():
    """
    Context manager to easily get a connection from the pool and return it when done.
    """
    if extensions.db_pool is None:
        raise Exception("Database pool is not initialized")
    
    conn = None
    try:
        conn = extensions.db_pool.getconn()
        yield conn
    except Exception as e:
        logging.error(f"Database connection error: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            extensions.db_pool.putconn(conn)

def execute_query(query, params=None, fetch=False, fetchone=False, commit=False):
    """
    Helper to execute a parameterised query securely.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            
            if commit:
                conn.commit()
                
            if fetchone:
                return cur.fetchone()
            if fetch:
                return cur.fetchall()
        return None
