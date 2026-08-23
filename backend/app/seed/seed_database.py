import json
import os
import sys

# Ensure backend root is in PYTHONPATH so app imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from app import create_app
from app.extensions import db
from app.models import Museum, Gallery, Collection, Exhibition, MuseumObject, LearningResource

def load_data():
    path = os.path.join(os.path.dirname(__file__), '..', '..', 'seed_data.json')
    if not os.path.exists(path):
        print(f"Error: {path} not found.")
        return {}
    with open(path, 'r') as f:
        return json.load(f)

def seed():
    app = create_app()
    with app.app_context():
        data = load_data()
        if not data:
            return

        try:
            # 1. Museum
            museums_inserted = 0
            for m_data in data.get('museums', []):
                museum = db.session.get(Museum, m_data['id'])
                if not museum:
                    museum = Museum(id=m_data['id'])
                    db.session.add(museum)
                    museums_inserted += 1
                
                museum.name = m_data.get('name')
                museum.description = m_data.get('description')
                museum.location = m_data.get('location')
                museum.image = m_data.get('image')

            db.session.flush()

            # 2. Gallery
            galleries_inserted = 0
            for g_data in data.get('galleries', []):
                gallery = db.session.get(Gallery, g_data['id'])
                if not gallery:
                    gallery = Gallery(id=g_data['id'])
                    db.session.add(gallery)
                    galleries_inserted += 1
                
                gallery.museum_id = g_data.get('museumId')
                gallery.name = g_data.get('name')
                gallery.description = g_data.get('description')
                gallery.image = g_data.get('image')

            db.session.flush()

            # 3. Collection
            collections_inserted = 0
            for c_data in data.get('collections', []):
                collection = db.session.get(Collection, c_data['id'])
                if not collection:
                    collection = Collection(id=c_data['id'])
                    db.session.add(collection)
                    collections_inserted += 1
                
                collection.museum_id = c_data.get('museumId')
                collection.name = c_data.get('name')
                collection.description = c_data.get('description')
                collection.image = c_data.get('image')

            db.session.flush()

            # 4. Exhibition
            exhibitions_inserted = 0
            for e_data in data.get('exhibitions', []):
                exhibition = db.session.get(Exhibition, e_data['id'])
                if not exhibition:
                    exhibition = Exhibition(id=e_data['id'])
                    db.session.add(exhibition)
                    exhibitions_inserted += 1
                
                exhibition.museum_id = e_data.get('museumId')
                exhibition.title = e_data.get('title')
                exhibition.subtitle = e_data.get('subtitle')
                exhibition.description = e_data.get('description')
                exhibition.long_description = e_data.get('longDescription')
                exhibition.image = e_data.get('image')
                exhibition.category = e_data.get('category')
                exhibition.theme = e_data.get('theme')
                exhibition.period = e_data.get('period')
                exhibition.location = e_data.get('location')
                exhibition.featured = e_data.get('featured', False)
                # Dates are strings in frontend, keep as null for now unless parsing is needed

            db.session.flush()

            # 5. Objects
            objects_inserted = 0
            for o_data in data.get('objects', []):
                obj = db.session.get(MuseumObject, o_data['id'])
                if not obj:
                    obj = MuseumObject(id=o_data['id'])
                    db.session.add(obj)
                    objects_inserted += 1
                
                obj.museum_id = o_data.get('museumId')
                obj.gallery_id = o_data.get('galleryId')
                obj.collection_id = o_data.get('collectionId')
                obj.name = o_data.get('name')
                obj.description = o_data.get('description')
                obj.image = o_data.get('image')
                obj.period = o_data.get('period')
                obj.origin = o_data.get('origin')
                obj.category = o_data.get('category')
                obj.featured = o_data.get('featured', False)
                obj.object_code = o_data.get('objectCode') or f"OBJ-{obj.id}"

            db.session.flush()

            # 6. Exhibition/Object relationships
            relationships_inserted = 0
            for e_data in data.get('exhibitions', []):
                exhibition = db.session.get(Exhibition, e_data['id'])
                if exhibition and 'objectIds' in e_data:
                    current_objects = {o.id for o in exhibition.objects}
                    for obj_id in e_data['objectIds']:
                        if obj_id not in current_objects:
                            obj = db.session.get(MuseumObject, obj_id)
                            if obj:
                                exhibition.objects.append(obj)
                                relationships_inserted += 1

            # 7. Learning Resources
            learning_inserted = 0
            for l_data in data.get('learning', []):
                lr = db.session.get(LearningResource, l_data['id'])
                if not lr:
                    lr = LearningResource(id=l_data['id'])
                    db.session.add(lr)
                    learning_inserted += 1
                
                lr.object_id = l_data.get('objectId')
                lr.title = l_data.get('title')
                lr.description = l_data.get('description')
                lr.type = l_data.get('type')
                lr.content = l_data.get('content')
                lr.duration = l_data.get('duration')
                lr.difficulty = l_data.get('difficulty')
                lr.category = l_data.get('category')
                lr.featured = l_data.get('featured', False)

            db.session.commit()
            
            print(f"Museums inserted: {museums_inserted}")
            print(f"Galleries inserted: {galleries_inserted}")
            print(f"Collections inserted: {collections_inserted}")
            print(f"Exhibitions inserted: {exhibitions_inserted}")
            print(f"Objects inserted: {objects_inserted}")
            print(f"Exhibition relationships inserted: {relationships_inserted}")
            print(f"Learning inserted: {learning_inserted}")
            
        except Exception as e:
            db.session.rollback()
            print(f"Errors:\n{e}")

if __name__ == '__main__':
    seed()
