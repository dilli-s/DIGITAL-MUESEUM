

export const CSV_ENTITY_SCHEMAS = {
  museums: {
    entityType: 'museums',
    label: 'Museums',
    primaryKeyField: 'name',
    fields: [
      { key: 'name', label: 'Museum Name', required: true, type: 'string', sample: 'Digital Museum Heritage Center' },
      { key: 'description', label: 'Description', required: false, type: 'string', sample: 'A digital and physical sanctuary showcasing natural history.' },
      { key: 'location', label: 'Address / Location Text', required: false, type: 'string', sample: '123 Heritage Way, Bengaluru' },
      { key: 'latitude', label: 'Main Latitude (GPS)', required: false, type: 'number', sample: '13.073226' },
      { key: 'longitude', label: 'Main Longitude (GPS)', required: false, type: 'number', sample: '80.257045' },
      { key: 'opening_hours', label: 'Opening Hours', required: false, type: 'string', sample: 'Mon-Sat 9AM-6PM' },
      { key: 'contact_email', label: 'Contact Email', required: false, type: 'string', sample: 'info@digitalmuseum.org' },
      { key: 'contact_phone', label: 'Contact Phone', required: false, type: 'string', sample: '+91-9876543210' },
      { key: 'image_url', label: 'Image URL', required: false, type: 'string', sample: 'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7' },
    ]
  },

  galleries: {
    entityType: 'galleries',
    label: 'Galleries',
    primaryKeyField: 'name',
    scopeField: 'museum_id',
    fields: [
      { key: 'name', label: 'Gallery Name', required: true, type: 'string', sample: 'Ancient Sculptures Hall' },
      { key: 'museum_id', label: 'Museum ID', required: true, type: 'number', sample: '1' },
      { key: 'description', label: 'Description', required: false, type: 'string', sample: 'Exhibits from the Chola and Hoysala periods.' },
      { key: 'floor', label: 'Floor Level', required: false, type: 'string', sample: '1' },
      { key: 'image_url', label: 'Image URL', required: false, type: 'string', sample: 'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3' },
    ]
  },

  collections: {
    entityType: 'collections',
    label: 'Collections',
    primaryKeyField: 'name',
    scopeField: 'museum_id',
    fields: [
      { key: 'name', label: 'Collection Name', required: true, type: 'string', sample: 'Royal Bronze Sculptures' },
      { key: 'museum_id', label: 'Museum ID', required: true, type: 'number', sample: '1' },
      { key: 'description', label: 'Description', required: false, type: 'string', sample: 'A rare collection of 10th-century bronze icons.' },
      { key: 'image_url', label: 'Image URL', required: false, type: 'string', sample: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119' },
    ]
  },

  exhibitions: {
    entityType: 'exhibitions',
    label: 'Exhibitions',
    primaryKeyField: 'title',
    scopeField: 'museum_id',
    fields: [
      { key: 'title', label: 'Exhibition Title', required: true, type: 'string', sample: 'Treasures of the Digital Museum' },
      { key: 'museum_id', label: 'Museum ID', required: true, type: 'number', sample: '1' },
      { key: 'subtitle', label: 'Subtitle', required: false, type: 'string', sample: 'A 500-Year Historical Journey' },
      { key: 'description', label: 'Short Description', required: false, type: 'string', sample: 'Special summer exhibition.' },
      { key: 'long_description', label: 'Long Description', required: false, type: 'string', sample: 'Detailed narrative about the artifacts on display.' },
      { key: 'category', label: 'Category', required: false, type: 'string', sample: 'Temporary Exhibition' },
      { key: 'theme', label: 'Theme', required: false, type: 'string', sample: 'South Indian Dynasty Art' },
      { key: 'period', label: 'Period', required: false, type: 'string', sample: '12th Century' },
      { key: 'location', label: 'Hall / Location Text', required: false, type: 'string', sample: 'North Wing Pavilion' },
      { key: 'start_date', label: 'Start Date (YYYY-MM-DD)', required: false, type: 'string', sample: '2026-01-01' },
      { key: 'end_date', label: 'End Date (YYYY-MM-DD)', required: false, type: 'string', sample: '2026-12-31' },
      { key: 'image_url', label: 'Image URL', required: false, type: 'string', sample: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675' },
    ]
  },

  objects: {
    entityType: 'objects',
    label: 'Objects / Exhibits',
    primaryKeyField: 'name',
    scopeField: 'museum_id',
    fields: [
      { key: 'name', label: 'Object Name', required: true, type: 'string', sample: 'Dancing Nataraja Statue' },
      { key: 'museum_id', label: 'Museum ID', required: true, type: 'number', sample: '1' },
      { key: 'gallery_id', label: 'Gallery ID', required: false, type: 'number', sample: '2' },
      { key: 'collection_id', label: 'Collection ID', required: false, type: 'number', sample: '1' },
      { key: 'object_code', label: 'Object Code / Accession #', required: false, type: 'string', sample: 'OBJ-2026-001' },
      { key: 'latitude', label: 'Latitude (GPS)', required: false, type: 'number', sample: '13.073226' },
      { key: 'longitude', label: 'Longitude (GPS)', required: false, type: 'number', sample: '80.257045' },
      { key: 'description', label: 'Description', required: false, type: 'string', sample: 'Bronze icon representing Lord Shiva in cosmic dance.' },
      { key: 'period', label: 'Period / Era', required: false, type: 'string', sample: '11th Century Chola' },
      { key: 'origin', label: 'Origin / Dynasty', required: false, type: 'string', sample: 'Thanjavur, Tamil Nadu' },
      { key: 'category', label: 'Category', required: false, type: 'string', sample: 'Sculpture' },
      { key: 'image_url', label: 'Image URL', required: false, type: 'string', sample: 'https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7' },
      { key: 'audio_url', label: 'Audio Tour URL', required: false, type: 'string', sample: 'https://example.com/audio/nataraja.mp3' },
      { key: 'video_url', label: 'Video Guide URL', required: false, type: 'string', sample: '' },
      { key: 'model_3d_url', label: '3D Model (.glb) URL', required: false, type: 'string', sample: '' },
    ]
  },

  learning: {
    entityType: 'learning',
    label: 'Learning Resources',
    primaryKeyField: 'title',
    scopeField: 'object_id',
    fields: [
      { key: 'title', label: 'Resource Title', required: true, type: 'string', sample: 'Understanding Chola Bronze Casting' },
      { key: 'object_id', label: 'Object ID', required: true, type: 'number', sample: '10' },
      { key: 'description', label: 'Description', required: false, type: 'string', sample: 'An educational guide on lost-wax casting technique.' },
      { key: 'type', label: 'Resource Type', required: false, type: 'string', sample: 'Article' },
      { key: 'category', label: 'Category', required: false, type: 'string', sample: 'Metallurgy & Art' },
      { key: 'duration', label: 'Estimated Reading Time', required: false, type: 'string', sample: '5 mins' },
      { key: 'difficulty', label: 'Difficulty Level', required: false, type: 'string', sample: 'Intermediate' },
    ]
  },

  stories: {
    entityType: 'stories',
    label: 'Stories',
    primaryKeyField: 'title',
    scopeField: 'object_id',
    fields: [
      { key: 'title', label: 'Story Title', required: true, type: 'string', sample: 'The Mystery of the Sacred Bronze' },
      { key: 'object_id', label: 'Object ID', required: true, type: 'number', sample: '10' },
      { key: 'summary', label: 'Summary', required: false, type: 'string', sample: 'How the idol survived centuries hidden underground.' },
      { key: 'duration', label: 'Audio Duration', required: false, type: 'string', sample: '3 mins' },
      { key: 'image_url', label: 'Header Image URL', required: false, type: 'string', sample: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119' },
    ]
  }
};
