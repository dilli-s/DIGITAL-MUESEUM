from app.utils.db import execute_query


_SELECT_COLS = "id, from_node_id, to_node_id, distance, walkable, created_at, edge_type"


def _row_to_dict(row):
    """Convert a map_edges row tuple to a dict."""
    if not row:
        return None
    return {
        "id": str(row[0]),
        "from_node_id": str(row[1]),
        "to_node_id": str(row[2]),
        "distance": row[3],
        "walkable": row[4],
        "created_at": row[5].isoformat() if row[5] else None,
        "edge_type": row[6] or "normal",
    }


def get_all_edges(museum_id=None, floor_plan_id=None):
    base = """
        SELECT e.id, e.from_node_id, e.to_node_id, e.distance, e.walkable, e.created_at, e.edge_type,
               fn.latitude AS from_latitude, fn.longitude AS from_longitude,
               tn.latitude AS to_latitude, tn.longitude AS to_longitude
        FROM map_edges e
        LEFT JOIN map_nodes fn ON e.from_node_id = fn.id
        LEFT JOIN map_nodes tn ON e.to_node_id = tn.id
    """
    conditions = []
    params = []

    if floor_plan_id is not None:
        conditions.append("(fn.floor_plan_id = %s::uuid OR tn.floor_plan_id = %s::uuid)")
        params.extend([floor_plan_id, floor_plan_id])

    if museum_id is not None:
        # Filter: at least the "from" node must belong to the museum's floor plans
        base += " LEFT JOIN floor_plans fp ON fn.floor_plan_id = fp.id "
        conditions.append("fp.museum_id = %s")
        params.append(museum_id)

    query = base
    if conditions:
        query += " WHERE " + " AND ".join(conditions)

    rows = execute_query(query, params if params else None, fetch=True)
    if not rows:
        return []
    return [
        {
            "id": str(r[0]),
            "from_node_id": str(r[1]),
            "to_node_id": str(r[2]),
            "distance": r[3],
            "walkable": r[4],
            "created_at": r[5].isoformat() if r[5] else None,
            "edge_type": r[6] or "normal",
            "from_latitude": float(r[7]) if r[7] is not None else None,
            "from_longitude": float(r[8]) if r[8] is not None else None,
            "to_latitude": float(r[9]) if r[9] is not None else None,
            "to_longitude": float(r[10]) if r[10] is not None else None,
        }
        for r in rows
    ]


def get_walkable_edges():
    query = f"SELECT from_node_id, to_node_id, distance, edge_type FROM map_edges WHERE walkable = TRUE"
    rows = execute_query(query, fetch=True)
    return [
        {
            "from_node_id": str(row[0]),
            "to_node_id": str(row[1]),
            "distance": row[2],
            "edge_type": row[3] or "normal",
        }
        for row in rows
    ] if rows else []


def create_edge(from_node_id, to_node_id, distance, walkable=True, edge_type="normal"):
    query = f"""
        INSERT INTO map_edges (from_node_id, to_node_id, distance, walkable, edge_type)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING {_SELECT_COLS}
    """
    row = execute_query(
        query,
        (from_node_id, to_node_id, distance, walkable, edge_type),
        fetchone=True,
        commit=True,
    )
    return _row_to_dict(row)


def delete_edge(edge_id):
    query = "DELETE FROM map_edges WHERE id = %s RETURNING id"
    row = execute_query(query, (edge_id,), fetchone=True, commit=True)
    return row is not None
