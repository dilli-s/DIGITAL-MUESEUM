import React, { useState, useEffect } from 'react';
import { getAdminActivities, createAdminActivity, updateAdminActivity, deleteAdminActivity, getAdminLearningResources } from '../../services/api';
import { Plus, Edit, Trash2, X, AlertTriangle } from 'lucide-react';

const AdminActivities = () => {
  const [activities, setActivities] = useState([]);
  const [resources, setResources] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [formData, setFormData] = useState({ 
    title: '', description: '', type: 'quiz', content: '{}', learning_resource_id: ''
  });
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [actRes, resRes] = await Promise.all([
        getAdminActivities(),
        getAdminLearningResources()
      ]);
      setActivities(actRes.data || []);
      setResources(resRes.data || []);
    } catch (err) {
      setError('Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await getAdminActivities();
      setActivities(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const openAddModal = () => {
    setEditingActivity(null);
    setFormData({ 
      title: '', description: '', type: 'quiz', content: '{\n  "questions": []\n}', 
      learning_resource_id: resources.length > 0 ? resources[0].id : ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (activity) => {
    setEditingActivity(activity);
    setFormData({
      title: activity.title || '',
      description: activity.description || '',
      type: activity.type || 'quiz',
      content: JSON.stringify(activity.content, null, 2) || '{}',
      learning_resource_id: activity.learning_resource_id || ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    
    try {
      const payload = { ...formData };
      if (!payload.learning_resource_id) {
        throw new Error("Learning Resource is required");
      }
      payload.learning_resource_id = parseInt(payload.learning_resource_id);
      
      // Basic JSON validation
      try {
        JSON.parse(payload.content);
      } catch (e) {
        throw new Error("Invalid JSON in content field");
      }
      
      if (editingActivity) {
        await updateAdminActivity(editingActivity.id, payload);
      } else {
        await createAdminActivity(payload);
      }
      setIsModalOpen(false);
      fetchActivities();
    } catch (err) {
      setFormError(err.message || err.response?.data?.error?.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAdminActivity(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchActivities();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete activity.');
      setDeleteConfirm(null);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-neutral-500">Loading activities...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">Manage Activities</h1>
        <button onClick={openAddModal} className="flex items-center px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800">
          <Plus className="w-5 h-5 mr-2" /> Add Activity
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Resource ID</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {activities.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-4 text-center text-neutral-500">No activities found.</td></tr>
            ) : activities.map(activity => (
              <tr key={activity.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{activity.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{activity.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {activity.type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{activity.learning_resource_id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => openEditModal(activity)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                    <Edit className="w-4 h-4 inline" />
                  </button>
                  <button onClick={() => setDeleteConfirm(activity)} className="text-red-600 hover:text-red-900">
                    <Trash2 className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-neutral-200 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold">{editingActivity ? 'Edit Activity' : 'Add Activity'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-neutral-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-neutral-700">Title *</label>
                <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Learning Resource *</label>
                <select required value={formData.learning_resource_id} onChange={e => setFormData({...formData, learning_resource_id: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border">
                  <option value="">Select a Learning Resource</option>
                  {resources.map(r => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700">Type</label>
                  <select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border">
                    <option value="quiz">Quiz</option>
                    <option value="puzzle">Puzzle</option>
                    <option value="drawing">Drawing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700">Description</label>
                  <input type="text" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Content (JSON) *</label>
                <textarea rows="8" required value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border font-mono text-sm"></textarea>
                <p className="mt-1 text-xs text-neutral-500">Must be valid JSON.</p>
              </div>
              <div className="pt-4 flex justify-end space-x-3 border-t border-neutral-200 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Delete Activity</h3>
            <p className="text-sm text-neutral-500 mb-6">Are you sure you want to delete "{deleteConfirm.title}"? This action cannot be undone.</p>
            <div className="flex justify-center space-x-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminActivities;
