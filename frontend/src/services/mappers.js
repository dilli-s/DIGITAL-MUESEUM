// Maps backend Museum response to match expected frontend mock data shape
export const mapMuseumFromApi = (museum) => {
  return {
    ...museum,
    // Provide safe defaults for fields missing from the Phase 12 database model
    category: museum.category || 'Uncategorized',
    longDescription: museum.description || '',
    established: museum.established || 'Unknown',
    galleryCount: museum.galleryCount || 0,
    collectionCount: museum.collectionCount || 0,
    objectCount: museum.objectCount || 0,
    exhibitionCount: museum.exhibitionCount || 0,
    featured: museum.featured || false,
  };
};

export const mapGalleryFromApi = (gallery) => {
  return {
    ...gallery,
    museumId: gallery.museum_id,
    objectCount: gallery.objectCount || 0,
    period: gallery.period || 'Unknown',
    theme: gallery.theme || 'Uncategorized'
  };
};

export const mapCollectionFromApi = (collection) => {
  return {
    ...collection,
    museumId: collection.museum_id,
    longDescription: collection.description || '',
    category: collection.category || 'Uncategorized',
    period: collection.period || 'Unknown',
    location: collection.location || 'Unknown',
    objectCount: collection.objectCount || 0,
    featured: collection.featured || false
  };
};

export const mapExhibitionFromApi = (exhibition) => {
  return {
    ...exhibition,
    museumId: exhibition.museum_id,
    longDescription: exhibition.long_description || '',
    startDate: exhibition.start_date || null,
    endDate: exhibition.end_date || null,
    objectIds: exhibition.objectIds || []
  };
};

export const mapObjectFromApi = (object) => {
  return {
    ...object,
    museumId: object.museum_id,
    galleryId: object.gallery_id,
    collectionId: object.collection_id,
    objectCode: object.object_code,
    longDescription: object.description || ''
  };
};

export const mapLearningFromApi = (learning) => {
  return {
    ...learning,
    objectId: learning.objectId
  };
};
