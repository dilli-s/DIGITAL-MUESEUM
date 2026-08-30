import logging
from flask import Flask, jsonify
from flask_cors import CORS
from app.config import Config
from app.extensions import init_db_pool

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Enable CORS for the frontend website
    CORS(app)

    # Initialize database pool
    with app.app_context():
        init_db_pool(app)

    # Register blueprints
    from app.routes.health import health_bp
    from app.routes.map import map_bp
    from app.routes.anchors import anchors_bp
    from app.routes.artifacts import artifacts_bp
    from app.routes.qr import qr_bp
    from app.routes.navigation import navigation_bp
    
    app.register_blueprint(health_bp)
    app.register_blueprint(map_bp, url_prefix='/api')
    app.register_blueprint(anchors_bp, url_prefix='/api')
    app.register_blueprint(artifacts_bp, url_prefix='/api')
    app.register_blueprint(qr_bp, url_prefix='/api')
    app.register_blueprint(navigation_bp, url_prefix='/api')
    
    # Generic error handler
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({"error": "Internal Server Error"}), 500
        
    @app.errorhandler(404)
    def not_found_error(error):
        return jsonify({"error": "Not Found"}), 404

    return app
