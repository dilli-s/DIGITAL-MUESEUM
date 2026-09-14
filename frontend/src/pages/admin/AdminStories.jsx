import React, { useState, useEffect } from 'react';
import { getAdminStories, createAdminStory, updateAdminStory, deleteAdminStory, getAdminObjects } from '../../services/api';
import { Plus, Edit, Trash2, X, AlertTriangle, Upload } from 'lucide-react';
import GenericCsvImporter from '../../components/admin/GenericCsvImporter';

const AdminStories = () => {
  const [stories, setStories] = useState([]);
  const [objects, setObjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStory, setEditingStory] = useState(null);
  const [formData, setFormData] = useState({ 
    title: '', content: '', object_id: '', author: '', theme: '', image_url: ''
  });
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [storRes, objsRes] = await Promise.all([
        getAdminStories(),
        getAdminObjects()
      ]);
      setStories(storRes.data || []);
      setObjects(objsRes.data || []);
    } catch (err) {
      setError('Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStories = async () => {
    try {
      const res = await getAdminStories();
      setStories(res.data || []);
    } catch (err) {
      console.log(err);
    }
  };

  const openAddModal = () => {
    setEditingStory(null);
    setFormData({ 
      title: '', content: '', object_id: objects.length > 0 ? objects[0].id : '', 
      author: '', theme: '', image_url: ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (story) => {
    setEditingStory(story);
    setFormData({
      title: story.title || '',
      content: story.content || '',
      object_id: story.object_id || '',
      author: story.author || '',
      theme: story.theme || '',
      image_url: story.image_url || ''
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
      if (!payload.object_id) {
        throw new Error("Object is required");
      }
      payload.object_id = parseInt(payload.object_id);
      
      if (editingStory) {
        await updateAdminStory(editingStory.id, payload);
      } else {
        await createAdminStory(payload);
      }
      setIsModalOpen(false);
      fetchStories();
    } catch (err) {
      setFormError(err.message || err.response?.data?.error?.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAdminStory(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchStories();
    } catch (err) {
      console.log(err.response?.data?.error?.message || 'Failed to delete story.');
      setDeleteConfirm(null);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-neutral-500">Loading stories...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">Manage Stories</h1>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setIsCsvModalOpen(true)} 
            className="flex items-center px-4 py-2 border border-neutral-300 bg-white text-neutral-800 rounded-md hover:bg-neutral-50 font-medium text-sm shadow-xs transition"
          >
            <Upload className="w-4 h-4 mr-2 text-indigo-600" /> Bulk Import CSV
          </button>
          <button onClick={openAddModal} className="flex items-center px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 font-medium text-sm">
            <Plus className="w-5 h-5 mr-2" /> Add Story
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Object ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Theme</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {stories.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-4 text-center text-neutral-500">No stories found.</td></tr>
            ) : stories.map(story => (
              <tr key={story.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{story.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{story.title}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{story.object_id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{story.theme || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => openEditModal(story)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                    <Edit className="w-4 h-4 inline" />
                  </button>
                  <button onClick={() => setDeleteConfirm(story)} className="text-red-600 hover:text-red-900">
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
              <h2 className="text-xl font-bold">{editingStory ? 'Edit Story' : 'Add Story'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-neutral-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-neutral-700">Title *</label>
                <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Object *</label>
                <select required value={formData.object_id} onChange={e => setFormData({...formData, object_id: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border">
                  <option value="">Select an Object</option>
                  {objects.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Content (Markdown)</label>
                <textarea rows="8" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border font-mono text-sm"></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700">Author</label>
                  <input type="text" value={formData.author} onChange={e => setFormData({...formData, author: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700">Theme</label>
                  <input type="text" value={formData.theme} onChange={e => setFormData({...formData, theme: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Image URL</label>
                <input type="url" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
              </div>
              <div className="pt-4 flex justify-end space-x-3 border-t border-neutral-200 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Story'}
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
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Delete Story</h3>
            <p className="text-sm text-neutral-500 mb-6">Are you sure you want to delete "{deleteConfirm.title}"? This action cannot be undone.</p>
            <div className="flex justify-center space-x-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Bulk Importer Modal */}
      <GenericCsvImporter
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        entityType="stories"
        existingItems={stories}
        createItem={createAdminStory}
        updateItem={updateAdminStory}
        onSuccess={fetchStories}
        defaultContext={objects.length > 0 ? { object_id: objects[0].id } : {}}
      />
    </div>
  );
};

export default AdminStories;
