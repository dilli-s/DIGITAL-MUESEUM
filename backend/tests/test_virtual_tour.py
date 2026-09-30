import unittest
import json
from app import create_app
from app.extensions import db
from app.models.museum import Museum
from app.models.tour import TourNode, TourEdge
from app.models.object import MuseumObject
from app.models.user import User


import uuid

class VirtualTourTestCase(unittest.TestCase):
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

        # Create test museum
        self.museum = Museum(name=f'Test Museum {uuid.uuid4().hex[:6]}', description='A test museum')
        db.session.add(self.museum)
        db.session.commit()

        # Login admin session
        with self.client.session_transaction() as sess:
            sess['_user_id'] = str(self.admin.id)

    def tearDown(self):
        if hasattr(self, 'museum') and self.museum.id:
            TourEdge.query.filter_by(museum_id=self.museum.id).delete()
            MuseumObject.query.filter_by(museum_id=self.museum.id).delete()
            TourNode.query.filter_by(museum_id=self.museum.id).delete()
            db.session.delete(self.museum)
            db.session.commit()
        db.session.remove()
        self.ctx.pop()

    def test_tour_node_ordering_and_start(self):
        # Create node 1 (not start)
        node1 = TourNode(museum_id=self.museum.id, name='Corridor A', is_start=False)
        db.session.add(node1)
        db.session.commit()

        # Create node 2 (is_start=True)
        node2 = TourNode(museum_id=self.museum.id, name='Main Entrance', is_start=True)
        db.session.add(node2)
        db.session.commit()

        # Create node 3 (not start)
        node3 = TourNode(museum_id=self.museum.id, name='Gallery Room', is_start=False)
        db.session.add(node3)
        db.session.commit()

        # Check admin nodes list ordering: node2 (start) should be first
        res = self.client.get(f'/api/admin/tour/nodes?museum_id={self.museum.id}')
        data = json.loads(res.data)['data']
        self.assertEqual(len(data), 3)
        self.assertEqual(data[0]['id'], node2.id)
        self.assertTrue(data[0]['is_start'])

        # Check public museum nodes list ordering
        res_pub = self.client.get(f'/api/tour/museums/{self.museum.id}/nodes')
        data_pub = json.loads(res_pub.data)['data']
        self.assertEqual(len(data_pub), 3)
        self.assertEqual(data_pub[0]['id'], node2.id)

    def test_two_way_edge_creation(self):
        node1 = TourNode(museum_id=self.museum.id, name='Room 1', is_start=True)
        node2 = TourNode(museum_id=self.museum.id, name='Room 2', is_start=False)
        db.session.add_all([node1, node2])
        db.session.commit()

        # Create forward edge with create_return_edge=True
        res = self.client.post('/api/admin/tour/edges', json={
            'museum_id': self.museum.id,
            'source_node_id': node1.id,
            'target_node_id': node2.id,
            'yaw': 45.0,
            'pitch': -10.0,
            'create_return_edge': True
        })
        self.assertEqual(res.status_code, 201)

        # Verify outgoing edges for node 1
        res1 = self.client.get(f'/api/admin/tour/nodes/{node1.id}')
        data1 = json.loads(res1.data)['data']
        self.assertEqual(len(data1['edges']), 1)
        self.assertEqual(data1['edges'][0]['target_node_id'], node2.id)
        self.assertEqual(data1['edges'][0]['yaw'], 45.0)

        # Verify return edge on node 2 was auto-created with reciprocal yaw (45 + 180 = 225)
        res2 = self.client.get(f'/api/admin/tour/nodes/{node2.id}')
        data2 = json.loads(res2.data)['data']
        self.assertEqual(len(data2['edges']), 1)
        self.assertEqual(data2['edges'][0]['target_node_id'], node1.id)
        self.assertEqual(data2['edges'][0]['yaw'], 225.0)

    def test_object_tour_unlinking(self):
        node = TourNode(museum_id=self.museum.id, name='Hallway', is_start=True)
        obj = MuseumObject(museum_id=self.museum.id, name='Ancient Vase')
        db.session.add_all([node, obj])
        db.session.commit()

        # Assign object to node
        res = self.client.patch(f'/api/admin/tour/objects/{obj.id}/tour-position', json={
            'tour_node_id': node.id,
            'tour_yaw': 30.0,
            'tour_pitch': -5.0
        })
        self.assertEqual(res.status_code, 200)
        updated_obj = json.loads(res.data)['data']
        self.assertEqual(updated_obj['tour_node_id'], node.id)
        self.assertEqual(updated_obj['tour_yaw'], 30.0)

        # Unlink object from node
        res_unlink = self.client.patch(f'/api/admin/tour/objects/{obj.id}/tour-position', json={
            'tour_node_id': None
        })
        self.assertEqual(res_unlink.status_code, 200)
        unlinked_obj = json.loads(res_unlink.data)['data']
        self.assertIsNone(unlinked_obj['tour_node_id'])
        self.assertIsNone(unlinked_obj['tour_yaw'])
        self.assertIsNone(unlinked_obj['tour_pitch'])


if __name__ == '__main__':
    unittest.main()
