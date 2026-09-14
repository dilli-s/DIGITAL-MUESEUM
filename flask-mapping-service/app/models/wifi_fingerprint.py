import json
import logging
import math
from typing import Any, TypedDict
from app.utils.db import execute_query, get_db_connection

logger = logging.getLogger(__name__)

class ScoredFingerprint(TypedDict):
    fingerprint: dict[str, Any]
    distance: float
    common_count: int
    common_ratio: float


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS wifi_fingerprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    x DOUBLE PRECISION NOT NULL,
    y DOUBLE PRECISION NOT NULL,
    readings JSONB NOT NULL DEFAULT '[]'::jsonb,
    surveyed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wifi_fingerprints_room_id ON wifi_fingerprints(room_id);
CREATE INDEX IF NOT EXISTS idx_wifi_fingerprints_surveyed_at ON wifi_fingerprints(surveyed_at);
"""

def init_wifi_fingerprint_table():
    """Ensure wifi_fingerprints table and indexes exist."""
    try:
        execute_query(CREATE_TABLE_SQL, fetch=False, commit=True)
        logger.info("wifi_fingerprints table verified/created.")
    except Exception as e:
        logger.warning(f"Could not auto-create wifi_fingerprints table: {e}")

def create_fingerprint(room_id, x, y, readings):
    """Store one surveyed WiFi fingerprint for a room."""
    # Ensure readings are JSON serializable
    if isinstance(readings, str):
        readings_json = readings
    else:
        readings_json = json.dumps(readings)

    query = """
        INSERT INTO wifi_fingerprints (room_id, x, y, readings)
        VALUES (%s::uuid, %s, %s, %s::jsonb)
        RETURNING id, room_id, x, y, readings, surveyed_at
    """
    rows = execute_query(query, (room_id, float(x), float(y), readings_json), fetch=True, commit=True)
    if not rows:
        return None
    r = rows[0]
    return {
        "id": str(r[0]),
        "room_id": str(r[1]),
        "x": float(r[2]),
        "y": float(r[3]),
        "readings": r[4] if isinstance(r[4], (list, dict)) else json.loads(r[4]),
        "surveyed_at": r[5].isoformat() if r[5] else None
    }

def get_fingerprints_by_room(room_id):
    """Retrieve all fingerprints for a specific room."""
    query = """
        SELECT id, room_id, x, y, readings, surveyed_at
        FROM wifi_fingerprints
        WHERE room_id = %s::uuid
        ORDER BY surveyed_at ASC
    """
    rows = execute_query(query, (room_id,), fetch=True) or []
    result = []
    for r in rows:
        readings_val = r[4]
        if isinstance(readings_val, str):
            try:
                readings_val = json.loads(readings_val)
            except Exception:
                readings_val = []
        result.append({
            "id": str(r[0]),
            "room_id": str(r[1]),
            "x": float(r[2]),
            "y": float(r[3]),
            "readings": readings_val,
            "surveyed_at": r[5].isoformat() if r[5] else None
        })
    return result

def delete_fingerprint(fingerprint_id):
    """Delete a fingerprint by ID."""
    query = "DELETE FROM wifi_fingerprints WHERE id = %s::uuid RETURNING id"
    rows = execute_query(query, (fingerprint_id,), fetch=True, commit=True)
    return bool(rows)

def get_room_coverage(room_id):
    """
    Lightweight coverage check:
    Returns count of fingerprints for room and whether coverage is sparse (< 3 points).
    """
    query = "SELECT COUNT(*) FROM wifi_fingerprints WHERE room_id = %s::uuid"
    rows = execute_query(query, (room_id,), fetch=True)
    count = rows[0][0] if rows else 0
    is_sparse = count < 3

    if count == 0:
        msg = "No WiFi fingerprints surveyed for this room."
        status = "empty"
    elif count < 3:
        msg = f"Sparse coverage: only {count} survey point(s). At least 3-5 points recommended."
        status = "sparse"
    elif count < 6:
        msg = f"Moderate coverage: {count} survey points recorded."
        status = "moderate"
    else:
        msg = f"Good coverage: {count} survey points recorded."
        status = "good"

    return {
        "room_id": str(room_id),
        "count": count,
        "is_sparse": is_sparse,
        "status": status,
        "message": msg
    }

def estimate_position(room_id, live_readings, k=3, min_confidence=0.40):
    """
    Compare live {bssid, rssi} readings against stored room fingerprints
    using weighted k-nearest neighbors (WKNN) with inverse RSSI distance.

    Returns:
    {
        "status": "ok" | "low_confidence" | "no_fingerprints",
        "coordinate": {"x": float, "y": float} | None,
        "confidence": float (0.0 to 1.0),
        "matched_k": int,
        "best_distance": float
    }
    """
    stored = get_fingerprints_by_room(room_id)
    if not stored:
        return {
            "status": "no_fingerprints",
            "coordinate": None,
            "confidence": 0.0,
            "matched_k": 0,
            "best_distance": None,
            "message": "No fingerprints surveyed for this room"
        }

    # Normalize live readings into a dict of {bssid_lower: rssi}
    live_map = {}
    for item in live_readings:
        bssid = item.get("bssid", "").strip().lower()
        rssi = item.get("rssi")
        if bssid and rssi is not None:
            try:
                live_map[bssid] = float(rssi)
            except (ValueError, TypeError):
                continue

    if not live_map:
        return {
            "status": "low_confidence",
            "coordinate": None,
            "confidence": 0.0,
            "matched_k": 0,
            "best_distance": None,
            "message": "Live readings list is empty or invalid"
        }

    DEFAULT_PENALTY_RSSI = -100.0  # dBm for undetected AP
    scored_fingerprints: list[ScoredFingerprint] = []

    for fp in stored:
        fp_readings = fp.get("readings", [])
        survey_map = {}
        for item in fp_readings:
            bssid = item.get("bssid", "").strip().lower()
            rssi = item.get("rssi")
            if bssid and rssi is not None:
                try:
                    survey_map[bssid] = float(rssi)
                except (ValueError, TypeError):
                    continue

        if not survey_map:
            continue

        all_bssids = set(live_map.keys()) | set(survey_map.keys())
        common_bssids = set(live_map.keys()) & set(survey_map.keys())

        # If zero common BSSIDs, distance is effectively infinite
        if not common_bssids:
            continue

        # Euclidean distance in signal space over union of BSSIDs
        sum_sq = 0.0
        for b in all_bssids:
            r_live = live_map.get(b, DEFAULT_PENALTY_RSSI)
            r_survey = survey_map.get(b, DEFAULT_PENALTY_RSSI)
            diff = r_live - r_survey
            sum_sq += diff * diff

        # Mean root square error across union
        dist = math.sqrt(sum_sq / len(all_bssids))

        # Penalize if few common BSSIDs
        common_ratio = len(common_bssids) / max(len(live_map), 1)
        if len(common_bssids) == 1:
            dist *= 1.8
        elif len(common_bssids) == 2:
            dist *= 1.3

        scored_fingerprints.append({
            "fingerprint": fp,
            "distance": dist,
            "common_count": len(common_bssids),
            "common_ratio": common_ratio
        })

    if not scored_fingerprints:
        return {
            "status": "low_confidence",
            "coordinate": None,
            "confidence": 0.0,
            "matched_k": 0,
            "best_distance": None,
            "message": "No matching BSSIDs between live reading and room fingerprints"
        }

    # Sort ascending by distance
    scored_fingerprints.sort(key=lambda s: s["distance"])

    best_distance = scored_fingerprints[0]["distance"]
    best_common = scored_fingerprints[0]["common_count"]

    # Calculate confidence score (0.0 to 1.0)
    # Typically, distance < 10 dBm error is great; > 28 dBm is poor
    dist_factor = max(0.0, min(1.0, 1.0 - (best_distance / 28.0)))
    ap_factor = min(1.0, best_common / 3.0)
    confidence = round(dist_factor * ap_factor, 3)

    if confidence < min_confidence:
        return {
            "status": "low_confidence",
            "coordinate": None,
            "confidence": confidence,
            "matched_k": len(scored_fingerprints[:k]),
            "best_distance": round(best_distance, 2),
            "message": f"Estimate confidence ({confidence}) below minimum threshold ({min_confidence})"
        }

    # Take top-k nearest neighbors
    top_k = scored_fingerprints[:max(1, min(k, len(scored_fingerprints)))]

    # Inverse distance weighting (w_i = 1 / (d_i + epsilon)^2)
    weights = []
    for s in top_k:
        w = 1.0 / math.pow(s["distance"] + 0.5, 2)
        weights.append(w)

    total_weight = sum(weights)
    if total_weight <= 0:
        return {
            "status": "low_confidence",
            "coordinate": None,
            "confidence": confidence,
            "matched_k": 0,
            "best_distance": round(best_distance, 2)
        }

    est_x = sum(w * s["fingerprint"]["x"] for w, s in zip(weights, top_k)) / total_weight
    est_y = sum(w * s["fingerprint"]["y"] for w, s in zip(weights, top_k)) / total_weight

    # Clamp normalized coordinates to [0.0, 1.0]
    est_x = max(0.0, min(1.0, est_x))
    est_y = max(0.0, min(1.0, est_y))

    return {
        "status": "ok",
        "coordinate": {
            "x": round(est_x, 5),
            "y": round(est_y, 5)
        },
        "confidence": confidence,
        "matched_k": len(top_k),
        "best_distance": round(best_distance, 2)
    }
