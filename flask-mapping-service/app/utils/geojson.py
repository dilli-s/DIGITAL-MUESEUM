def to_geojson_point(node):
    if node.get("latitude") is None or node.get("longitude") is None:
        return None
    return {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [node["longitude"], node["latitude"]]
        },
        "properties": {
            "id": node.get("id"),
            "name": node.get("name"),
            "type": node.get("node_type"),
            "floor": node.get("floor")
        }
    }

def to_geojson_linestring(edge, from_node, to_node):
    if from_node.get("latitude") is None or from_node.get("longitude") is None or \
       to_node.get("latitude") is None or to_node.get("longitude") is None:
        return None
    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [from_node["longitude"], from_node["latitude"]],
                [to_node["longitude"], to_node["latitude"]]
            ]
        },
        "properties": {
            "id": edge.get("id"),
            "from_node_id": edge.get("from_node_id"),
            "to_node_id": edge.get("to_node_id"),
            "distance": edge.get("distance"),
            "isFloorChange": from_node.get("floor") != to_node.get("floor"),
            "edge_type": edge.get("edge_type"),
            "floor": from_node.get("floor") # or handle multiple floors
        }
    }

def to_geojson_polygon(gallery):
    polygon = gallery.get("boundary_polygon")
    if not polygon:
        return None
    # polygon should be list of {lat, lng} objects or similar
    # ensure it forms a closed ring
    coordinates = []
    if isinstance(polygon, list) and len(polygon) > 0:
        for pt in polygon:
            if "longitude" in pt and "latitude" in pt:
                coordinates.append([pt["longitude"], pt["latitude"]])
            elif "lng" in pt and "lat" in pt:
                coordinates.append([pt["lng"], pt["lat"]])
        
        if len(coordinates) > 0:
            if coordinates[0] != coordinates[-1]:
                coordinates.append(coordinates[0]) # close the ring
    
    if len(coordinates) < 4: # Polygon needs at least 4 points (3 + closed)
        return None

    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [coordinates]
        },
        "properties": {
            "id": gallery.get("id"),
            "name": gallery.get("name"),
            "floor": gallery.get("floor")
        }
    }
