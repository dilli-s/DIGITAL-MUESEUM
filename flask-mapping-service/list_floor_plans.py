import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()
cur.execute("SELECT id, name, museum_id FROM floor_plans;")
for row in cur.fetchall():
    print(row)
