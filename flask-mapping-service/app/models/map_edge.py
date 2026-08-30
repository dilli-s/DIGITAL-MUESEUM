from app.utils.db import execute_query

def get_all_edges():
    query = "SELECT id, from_node_id, to_node_id, distance, walkable, created_at FROM map_edges"
    rows = execute_query(query, fetch=True)
    
    return [
        {
            "id": str(row[0]),
            "from_node_id": str(row[1]),
            "to_node_id": str(row[2]),
            "distance": row[3],
            "walkable": row[4],
            "created_at": row[5].isoformat() if row[5] else None
        } for row in rows
    ] if rows else []

def get_walkable_edges():
    query = "SELECT from_node_id, to_node_id, distance FROM map_edges WHERE walkable = TRUE"
    rows = execute_query(query, fetch=True)
    
    return [
        {
            "from_node_id": str(row[0]),
            "to_node_id": str(row[1]),
            "distance": row[2]
        } for row in rows
    ] if rows else []

def create_edge(from_node_id, to_node_id, distance, walkable=True):
    query = """
        INSERT INTO map_edges (from_node_id, to_node_id, distance, walkable) 
        VALUES (%s, %s, %s, %s) 
        RETURNING id, from_node_id, to_node_id, distance, walkable, created_at
    """
    row = execute_query(query, (from_node_id, to_node_id, distance, walkable), fetchone=True, commit=True)
    
    if row:
        return {
            "id": str(row[0]),
            "from_node_id": str(row[1]),
            "to_node_id": str(row[2]),
            "distance": row[3],
            "walkable": row[4],
            "created_at": row[5].isoformat() if row[5] else None
        }
    return None
