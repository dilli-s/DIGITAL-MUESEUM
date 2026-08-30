ALTER TABLE map_nodes DROP CONSTRAINT IF EXISTS map_nodes_node_type_check;
ALTER TABLE map_nodes ADD CONSTRAINT map_nodes_node_type_check 
CHECK (node_type IN ('exhibit', 'junction', 'entrance', 'exit', 'amenity', 'restroom', 'cafe', 'giftshop', 'elevator', 'stairs', 'artifact'));
