from app.utils.geo import pixel_to_latlng, latlng_to_pixel

# Dummy floor plan
plan = {
    'anchor_1_x_px': 100,
    'anchor_1_y_px': 100,
    'anchor_1_lat': 40.7128,  # NYC roughly
    'anchor_1_lng': -74.0060,
    
    'anchor_2_x_px': 500,
    'anchor_2_y_px': 100,
    'anchor_2_lat': 40.7128,
    'anchor_2_lng': -74.0010, # shifted roughly ~422 meters east at this latitude
}

# Test forward
lat, lng = pixel_to_latlng(500, 100, plan)
print(f"P2 (500, 100) -> Lat: {lat}, Lng: {lng}")
assert abs(lat - plan['anchor_2_lat']) < 0.0001
assert abs(lng - plan['anchor_2_lng']) < 0.0001

# Test inverse
x, y = latlng_to_pixel(lat, lng, plan)
print(f"Inv (lat, lng) -> X: {x}, Y: {y}")
assert abs(x - 500) < 0.01
assert abs(y - 100) < 0.01

print("Verification passed!")
