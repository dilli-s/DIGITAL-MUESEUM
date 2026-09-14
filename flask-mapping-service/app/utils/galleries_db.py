from app.utils.db import execute_query

def get_galleries_by_floor(floor: str):
    """Fetch galleries for a specific floor (string) to use as room boundaries."""
    query = """
        SELECT id, name, floor, boundary_polygon
        FROM galleries
        WHERE floor = %s
    """
    results = execute_query(query, (str(floor),), fetch=True)
    galleries = []
    if results:
        for row in results:
            galleries.append({
                "id": row[0],
                "name": row[1],
                "floor": row[2],
                "boundary_polygon": row[3]
            })
    return galleries
