from contextlib import contextmanager
from app import extensions
import psycopg2
import logging
import time
from typing import Any

DISCONNECT_PATTERNS = (
    "ssl syscall error",
    "eof detected",
    "connection already closed",
    "closed",
    "server closed the connection unexpectedly",
    "terminating connection",
    "could not receive data from server",
    "software caused connection abort",
    "broken pipe",
    "connection reset by peer",
    "bad connection",
    "connection is closed",
    "closed connection",
    "server disconnected",
)

def is_disconnect_error(e: Exception) -> bool:
    """Returns True if the exception indicates a broken or dropped database connection."""
    if isinstance(e, (psycopg2.OperationalError, psycopg2.InterfaceError)):
        return True
    msg = str(e).lower()
    return any(p in msg for p in DISCONNECT_PATTERNS)

def is_connection_alive(conn) -> bool:
    """Fast pre-ping to ensure PostgreSQL socket is still responsive."""
    if conn is None or getattr(conn, "closed", 1) != 0:
        return False
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
        return True
    except Exception:
        return False

@contextmanager
def get_db_connection():
    """
    Context manager to safely checkout a verified, healthy connection from the pool.
    Dead or idle-dropped connections are automatically discarded with close=True.
    """
    if extensions.db_pool is None:
        raise Exception("Database pool is not initialized")

    conn = None
    is_broken = False
    try:
        # Pre-ping and checkout loop: discard stale connections if server dropped them
        for _ in range(3):
            try:
                candidate = extensions.db_pool.getconn()
            except Exception as e:
                logging.warning(f"Error checking out connection from pool: {e}. Attempting pool re-initialization.")
                extensions.reinit_db_pool()
                candidate = extensions.db_pool.getconn()

            if is_connection_alive(candidate):
                conn = candidate
                break
            else:
                logging.info("Discarding stale/idle-dropped connection from pool (pre-ping failed).")
                try:
                    extensions.db_pool.putconn(candidate, close=True)
                except Exception:
                    try:
                        candidate.close()
                    except Exception:
                        pass

        # If all pool connections were stale, rebuild the pool
        if conn is None:
            logging.warning("All pooled connections were dead. Re-initializing pool...")
            extensions.reinit_db_pool()
            conn = extensions.db_pool.getconn()

        yield conn
    except Exception as e:
        if is_disconnect_error(e):
            is_broken = True
            logging.warning(f"Database connection dropped during query: {e}. Connection will be discarded.")
        else:
            logging.error(f"Database query error: {e}")

        if conn and not is_broken:
            try:
                conn.rollback()
            except Exception:
                is_broken = True
        raise
    finally:
        if conn:
            try:
                if is_broken or getattr(conn, "closed", 1) != 0:
                    extensions.db_pool.putconn(conn, close=True)
                else:
                    extensions.db_pool.putconn(conn)
            except Exception:
                try:
                    conn.close()
                except Exception:
                    pass

def execute_query(query, params=None, fetch=False, fetchone=False, commit=False) -> Any:
    """
    Helper to execute a parameterised query securely with auto-retry on any dropped or closed connection.
    """
    max_attempts = 3
    for attempt in range(max_attempts):
        try:
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
        except Exception as e:
            if is_disconnect_error(e) and attempt < max_attempts - 1:
                logging.warning(
                    f"Database connection severed on attempt {attempt + 1}/{max_attempts} ({e}). "
                    f"Retrying query with a fresh connection..."
                )
                time.sleep(0.1 * (attempt + 1))
                continue
            raise

