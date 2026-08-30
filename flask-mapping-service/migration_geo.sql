ALTER TABLE floor_plans
ADD COLUMN anchor_1_x_px FLOAT,
ADD COLUMN anchor_1_y_px FLOAT,
ADD COLUMN anchor_1_lat FLOAT,
ADD COLUMN anchor_1_lng FLOAT,
ADD COLUMN anchor_2_x_px FLOAT,
ADD COLUMN anchor_2_y_px FLOAT,
ADD COLUMN anchor_2_lat FLOAT,
ADD COLUMN anchor_2_lng FLOAT;

ALTER TABLE map_nodes
ADD COLUMN latitude FLOAT,
ADD COLUMN longitude FLOAT;
