import time
import logging
from flask import Flask, request, g
from flask_cors import CORS
from app.config import Config
from app.extensions import db, migrate, login_manager

# Set up basic logging for API
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('api')

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    @app.before_request
    def start_timer():
        g.start_time = time.time()

    @app.after_request
    def log_request(response):
        if hasattr(g, 'start_time'):
            duration = time.time() - g.start_time
            # Don't log sensitive info, just basic metrics
            logger.info(f"{request.method} {request.path} {response.status_code} {duration:.4f}s")
            
        # Security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        
        return response

    @app.errorhandler(Exception)
    def handle_exception(e):
        from werkzeug.exceptions import HTTPException
        from flask import jsonify
        
        # Pass through HTTP errors
        if isinstance(e, HTTPException):
            return jsonify({"error": {"code": str(e.code), "message": e.description}}), e.code
            
        # Global error handler for 500
        logger.error(f"Server Error: {str(e)}", exc_info=True)
        return jsonify({"error": {"code": "INTERNAL_ERROR", "message": "Something went wrong."}}), 500

    @app.route('/')
    def index():
        from flask import jsonify
        return jsonify({"status": "ok", "message": "Digital Museum API is running"})

    # Initialize CORS safely with credentials support
    CORS(app, origins=[app.config['FRONTEND_URL']], supports_credentials=True)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    
    login_manager.init_app(app)
    
    from app.models.user import User
    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))
        
    @login_manager.unauthorized_handler
    def unauthorized():
        from flask import jsonify
        return jsonify({"error": {"code": "UNAUTHORIZED", "message": "Not authenticated"}}), 401

    # Register blueprints
    from app.routes.health import health_bp
    from app.routes.museums import museum_bp
    from app.routes.galleries import gallery_bp
    from app.routes.collections import collection_bp
    from app.routes.exhibitions import exhibition_bp
    from app.routes.objects import object_bp
    from app.routes.learning import learning_bp
    from app.routes.auth import auth_bp
    from app.routes.bookmarks import bookmarks_bp
    from app.routes.progress import progress_bp
    from app.routes.activities_progress import activities_progress_bp
    from app.routes.history import history_bp
    from app.routes.ai import ai_bp
    from app.routes.recommendations import recommendations_bp
    from app.routes.admin.dashboard import admin_dashboard_bp
    from app.routes.admin.museums import admin_museums_bp
    from app.routes.admin.galleries import admin_galleries_bp
    from app.routes.admin.collections import admin_collections_bp
    from app.routes.admin.exhibitions import admin_exhibitions_bp
    from app.routes.admin.objects import admin_objects_bp
    from app.routes.admin.learning import admin_learning_bp
    from app.routes.admin.stories import admin_stories_bp
    from app.routes.admin.activities import admin_activities_bp
    from app.routes.admin.analytics import admin_analytics_bp
    from app.routes.admin.health import admin_health_bp
    
    app.register_blueprint(health_bp, url_prefix='/api')
    app.register_blueprint(museum_bp, url_prefix='/api')
    app.register_blueprint(gallery_bp, url_prefix='/api')
    app.register_blueprint(collection_bp, url_prefix='/api')
    app.register_blueprint(exhibition_bp, url_prefix='/api')
    app.register_blueprint(object_bp, url_prefix='/api')
    app.register_blueprint(learning_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(bookmarks_bp, url_prefix='/api/bookmarks')
    app.register_blueprint(progress_bp, url_prefix='/api/progress')
    app.register_blueprint(activities_progress_bp, url_prefix='/api/activities')
    app.register_blueprint(history_bp, url_prefix='/api/history')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(recommendations_bp, url_prefix='/api/recommendations')
    
    # Admin Blueprints
    app.register_blueprint(admin_dashboard_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_museums_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_galleries_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_collections_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_exhibitions_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_objects_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_learning_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_stories_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_activities_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_analytics_bp, url_prefix='/api/admin')
    app.register_blueprint(admin_health_bp, url_prefix='/api/admin')

    # Import models so SQLAlchemy knows about them
    with app.app_context():
        from app.models import museum, gallery, collection, exhibition, object, learning, story, activity, user, bookmark, learning_progress, activity_progress, history

    return app
