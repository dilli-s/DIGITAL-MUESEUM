from app import create_app
from app.models.map_node import get_node_by_id

app = create_app()
with app.app_context():
    print(get_node_by_id('043e4dcd-0ab8-489b-84c2-1f8fc8381cb0'))
