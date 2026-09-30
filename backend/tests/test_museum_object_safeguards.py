import unittest
import json
import uuid
from app import create_app
from app.extensions import db
from app.models.museum import Museum
from app.models.gallery import Gallery
from app.models.object import MuseumObject
from app.models.user import User


class MuseumObjectSafeguardsTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()

        # Find or create admin user
        self.admin = User.query.filter_by(role='admin').first()
        if not self.admin:
            self.admin = User(name='Admin User', email=f'admin_{uuid.uuid4().hex[:8]}@example.com', role='admin')
            self.admin.set_password('password123')
            db.session.add(self.admin)
            db.session.commit()

        # Login admin session
        with self.client.session_transaction() as sess:
            sess['_user_id'] = str(self.admin.id)

    def tearDown(self):
        db.session.rollback()
        db.session.remove()
        self.ctx.pop()

    def test_create_museum_auto_creates_default_gallery(self):
        """Creating a new museum must automatically create a default 'Main Gallery'."""
        museum_name = f'Auto Gallery Museum {uuid.uuid4().hex[:6]}'
        res = self.client.post('/api/admin/museums', json={
            'name': museum_name,
            'description': 'Test museum'
        })
        self.assertEqual(res.status_code, 201)
        data = res.get_json()['data']
        museum_id = data['id']

        # Verify gallery was created
        galleries = Gallery.query.filter_by(museum_id=museum_id).all()
        self.assertGreaterEqual(len(galleries), 1)
        self.assertEqual(galleries[0].name, 'Main Gallery')

        # Cleanup
        db.session.delete(Museum.query.get(museum_id))
        db.session.commit()

    def test_create_object_without_gallery_auto_assigns_to_museum_gallery(self):
        """Creating an object without a gallery_id must fallback to the museum's existing gallery."""
        # Create museum
        museum = Museum(name=f'Museum {uuid.uuid4().hex[:6]}', description='Test')
        db.session.add(museum)
        db.session.commit()

        # Add a custom gallery
        gallery = Gallery(name='Ancient Wing', museum_id=museum.id)
        db.session.add(gallery)
        db.session.commit()

        # Create object without gallery_id
        res = self.client.post('/api/admin/objects', json={
            'name': 'Golden Scepter',
            'museum_id': museum.id
        })
        self.assertEqual(res.status_code, 201)
        obj_data = res.get_json()['data']
        self.assertEqual(obj_data['gallery_id'], gallery.id)

        # Verify in DB
        db_obj = MuseumObject.query.get(obj_data['id'])
        self.assertIsNotNone(db_obj.gallery_id)
        self.assertEqual(db_obj.gallery_id, gallery.id)

        # Cleanup
        MuseumObject.query.filter_by(museum_id=museum.id).delete()
        Gallery.query.filter_by(museum_id=museum.id).delete()
        db.session.delete(museum)
        db.session.commit()

    def test_delete_gallery_reallocates_objects(self):
        """Deleting a gallery must reallocate any objects inside it so they are never orphaned."""
        museum = Museum(name=f'Museum {uuid.uuid4().hex[:6]}', description='Test')
        db.session.add(museum)
        db.session.commit()

        gal1 = Gallery(name='Gallery 1', museum_id=museum.id)
        gal2 = Gallery(name='Gallery 2', museum_id=museum.id)
        db.session.add_all([gal1, gal2])
        db.session.commit()

        obj = MuseumObject(name='Artifact X', museum_id=museum.id, gallery_id=gal1.id)
        db.session.add(obj)
        db.session.commit()

        # Delete Gal1
        res = self.client.delete(f'/api/admin/galleries/{gal1.id}')
        self.assertEqual(res.status_code, 200)

        # Verify Artifact X was reallocated to gal2
        db_obj = MuseumObject.query.get(obj.id)
        self.assertEqual(db_obj.gallery_id, gal2.id)

        # Cleanup
        MuseumObject.query.filter_by(museum_id=museum.id).delete()
        Gallery.query.filter_by(museum_id=museum.id).delete()
        db.session.delete(museum)
        db.session.commit()


if __name__ == '__main__':
    unittest.main()
