from app.utils.db import execute_query


def _row_to_dict(row):
    """Convert a map_nodes row tuple to a dict."""
    if not row:
        return None
    return {
        "id": str(row[0]),
        "name": row[1],
        "floor": row[2],
        "x_coordinate": row[3],
        "y_coordinate": row[4],
        "node_type": row[5],
        "created_at": row[6].isoformat() if row[6] else None,
        "floor_plan_id": str(row[7]) if row[7] else None,
        "object_id": row[8],
        "latitude": float(row[9]) if row[9] is not None else None,
        "longitude": float(row[10]) if row[10] is not None else None,
        "is_manually_corrected": bool(row[11]) if len(row) > 11 and row[11] is not None else False,
        "is_must_visit": bool(row[12]) if len(row) > 12 and row[12] is not None else False,
        "artifact_id": str(row[13]) if len(row) > 13 and row[13] is not None else None,
    }


_SELECT_COLS = (
    "id, name, floor, x_coordinate, y_coordinate, node_type, "
    "created_at, floor_plan_id, object_id, latitude, longitude, is_manually_corrected, is_must_visit, artifact_id"
)


def get_all_nodes(floor_plan_id=None, floor=None, museum_id=None) -> list[dict]:
    params = []
    conditions = []

    if museum_id is not None:
        # JOIN floor_plans to filter by museum — nodes are scoped via their floor plan
        query = (
            f"SELECT n.{', n.'.join(_SELECT_COLS.split(', '))} "
            "FROM map_nodes n "
            "JOIN floor_plans fp ON n.floor_plan_id = fp.id "
        )
        conditions.append("fp.museum_id = %s")
        params.append(museum_id)
    else:
        query = f"SELECT {_SELECT_COLS} FROM map_nodes"

    if floor_plan_id is not None:
        conditions.append(("n.floor_plan_id" if museum_id is not None else "floor_plan_id") + " = %s::uuid")
        params.append(floor_plan_id)
    if floor is not None:
        conditions.append(("n.floor" if museum_id is not None else "floor") + " = %s")
        params.append(floor)

    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY " + ("n.floor, n.name" if museum_id is not None else "floor, name")

    rows = execute_query(query, params, fetch=True)
    if not rows:
        return []
    return [d for r in rows if (d := _row_to_dict(r)) is not None]


def get_node_by_id(node_id):
    query = f"SELECT {_SELECT_COLS} FROM map_nodes WHERE id = %s::uuid"
    row = execute_query(query, (node_id,), fetchone=True)
    return _row_to_dict(row)


def create_node(name, floor, x, y, node_type, floor_plan_id=None, object_id=None, latitude=None, longitude=None, is_manually_corrected=False, is_must_visit=False, artifact_id=None):
    query = f"""
        INSERT INTO map_nodes (name, floor, x_coordinate, y_coordinate, node_type, floor_plan_id, object_id, latitude, longitude, is_manually_corrected, is_must_visit, artifact_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING {_SELECT_COLS}
    """
    row = execute_query(
        query,
        (name, floor, x, y, node_type, floor_plan_id, object_id, latitude, longitude, is_manually_corrected, is_must_visit, artifact_id),
        fetchone=True,
        commit=True,
    )
    return _row_to_dict(row)


def update_node(node_id, data):
    fields = []
    values = []
    valid_keys = [
        "name", "floor", "x_coordinate", "y_coordinate", "node_type",
        "floor_plan_id", "object_id", "latitude", "longitude", "is_manually_corrected", "is_must_visit", "artifact_id"
    ]

    for key, value in data.items():
        if key in valid_keys:
            fields.append(f"{key} = %s")
            values.append(value)

    if not fields:
        return get_node_by_id(node_id)

    values.append(node_id)
    query = f"UPDATE map_nodes SET {', '.join(fields)} WHERE id = %s::uuid RETURNING {_SELECT_COLS}"
    row = execute_query(query, tuple(values), fetchone=True, commit=True)
    return _row_to_dict(row)


def delete_node(node_id):
    execute_query("DELETE FROM map_nodes WHERE id = %s::uuid", (node_id,), commit=True)
    return True
