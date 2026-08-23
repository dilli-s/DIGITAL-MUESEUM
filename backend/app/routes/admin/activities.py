from flask import Blueprint, jsonify, request
from app.utils.decorators import admin_required
from app.models import Activity, LearningResource
from app.extensions import db
import json

admin_activities_bp = Blueprint('admin_activities', __name__)

@admin_activities_bp.route('/activities', methods=['GET'])
@admin_required
def get_activities():
    try:
        learning_id = request.args.get('learning_resource_id')
        query = Activity.query
        
        if learning_id:
            query = query.filter_by(learning_resource_id=learning_id)
            
        activities = query.all()
        return jsonify({
            "data": [a.serialize() for a in activities]
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch activities."}}), 500

@admin_activities_bp.route('/activities/<int:activity_id>', methods=['GET'])
@admin_required
def get_activity(activity_id):
    try:
        activity = Activity.query.get(activity_id)
        if not activity:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Activity not found."}}), 404
        return jsonify({
            "data": activity.serialize()
        })
    except Exception as e:
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to fetch activity."}}), 500

@admin_activities_bp.route('/activities', methods=['POST'])
@admin_required
def create_activity():
    try:
        data = request.json
        if not data or not data.get('title') or not data.get('type') or not data.get('learning_resource_id'):
            return jsonify({"error": {"code": "INVALID_INPUT", "message": "Title, type, and learning_resource_id are required."}}), 400
            
        resource = LearningResource.query.get(data['learning_resource_id'])
        if not resource:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Learning resource does not exist."}}), 404
            
        activity = Activity(
            title=data['title'],
            description=data.get('description'),
            type=data['type'],
            content=data.get('content') if isinstance(data.get('content'), dict) else json.loads(data.get('content', '{}')),
            learning_resource_id=data['learning_resource_id']
        )
        db.session.add(activity)
        db.session.commit()
        return jsonify({
            "data": activity.serialize()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to create activity."}}), 500

@admin_activities_bp.route('/activities/<int:activity_id>', methods=['PATCH'])
@admin_required
def update_activity(activity_id):
    try:
        activity = Activity.query.get(activity_id)
        if not activity:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Activity not found."}}), 404
            
        data = request.json
        
        if 'learning_resource_id' in data:
            resource = LearningResource.query.get(data['learning_resource_id'])
            if not resource:
                return jsonify({"error": {"code": "NOT_FOUND", "message": "Learning resource does not exist."}}), 404
                
        allowed_fields = ['title', 'description', 'type', 'content', 'learning_resource_id']
        for field in allowed_fields:
            if field in data:
                if field == 'content' and isinstance(data[field], str):
                    try:
                        setattr(activity, field, json.loads(data[field]))
                    except json.JSONDecodeError:
                        return jsonify({"error": {"code": "INVALID_INPUT", "message": "Invalid JSON in content."}}), 400
                else:
                    setattr(activity, field, data[field])
                
        db.session.commit()
        return jsonify({
            "data": activity.serialize()
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to update activity."}}), 500

@admin_activities_bp.route('/activities/<int:activity_id>', methods=['DELETE'])
@admin_required
def delete_activity(activity_id):
    try:
        activity = Activity.query.get(activity_id)
        if not activity:
            return jsonify({"error": {"code": "NOT_FOUND", "message": "Activity not found."}}), 404
            
        db.session.delete(activity)
        db.session.commit()
        return jsonify({
            "data": {"success": True}
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": {"code": "SERVER_ERROR", "message": "Failed to delete activity."}}), 500
