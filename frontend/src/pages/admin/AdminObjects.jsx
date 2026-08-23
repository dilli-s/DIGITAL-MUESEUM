import React, { useState, useEffect } from 'react';
import { getAdminObjects, createAdminObject, updateAdminObject, deleteAdminObject, getAdminMuseums, getAdminGalleries, getAdminCollections } from '../../services/api';
import { Plus, Edit, Trash2, X, AlertTriangle, Search } from 'lucide-react';

const AdminObjects = () => {
  const [objects, setObjects] = useState([]);
  const [museums, setMuseums] = useState([]);
  const [galleries, setGalleries] = useState([]);
  const [collections, setCollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingObject, setEditingObject] = useState(null);
  const [formData, setFormData] = useState({ 
    title: '', description: '', museum_id: '', gallery_id: '', collection_id: '',
    creator: '', creation_date: '', medium: '', dimensions: '',
    image_url: '', model_3d_url: '', audio_url: ''
  });
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchObjects();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [objsRes, musRes, galsRes, colsRes] = await Promise.all([
        getAdminObjects(),
        getAdminMuseums(),
        getAdminGalleries(),
        getAdminCollections()
      ]);
      setObjects(objsRes.data || []);
      setMuseums(musRes.data || []);
      setGalleries(galsRes.data || []);
      setCollections(colsRes.data || []);
    } catch (err) {
      setError('Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchObjects = async () => {
    try {
      const res = await getAdminObjects({ search: searchQuery });
      setObjects(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const openAddModal = () => {
    setEditingObject(null);
    setFormData({ 
      title: '', description: '', museum_id: museums.length > 0 ? museums[0].id : '', 
      gallery_id: '', collection_id: '', creator: '', creation_date: '', 
      medium: '', dimensions: '', image_url: '', model_3d_url: '', audio_url: ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (obj) => {
    setEditingObject(obj);
    setFormData({
      title: obj.title || '',
      description: obj.description || '',
      museum_id: obj.museum_id || '',
      gallery_id: obj.gallery_id || '',
      collection_id: obj.collection_id || '',
      creator: obj.creator || '',
      creation_date: obj.creation_date || '',
      medium: obj.medium || '',
      dimensions: obj.dimensions || '',
      image_url: obj.image_url || '',
      model_3d_url: obj.model_3d_url || '',
      audio_url: obj.audio_url || ''
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
      if (!payload.museum_id) {
        throw new Error("Museum is required");
      }
      payload.museum_id = parseInt(payload.museum_id);
      payload.gallery_id = payload.gallery_id ? parseInt(payload.gallery_id) : '';
      payload.collection_id = payload.collection_id ? parseInt(payload.collection_id) : '';
      
      if (editingObject) {
        await updateAdminObject(editingObject.id, payload);
      } else {
        await createAdminObject(payload);
      }
      setIsModalOpen(false);
      fetchObjects();
    } catch (err) {
      setFormError(err.message || err.response?.data?.error?.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAdminObject(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchObjects();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete object.');
      setDeleteConfirm(null);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-neutral-500">Loading objects...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  const relevantGalleries = formData.museum_id ? galleries.filter(g => g.museum_id === parseInt(formData.museum_id)) : [];
  const relevantCollections = formData.museum_id ? collections.filter(c => c.museum_id === parseInt(formData.museum_id)) : [];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">Manage Objects</h1>
        <button onClick={openAddModal} className="flex items-center px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800">
          <Plus className="w-5 h-5 mr-2" /> Add Object
        </button>
      </div>
      
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-neutral-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-neutral-300 rounded-md leading-5 bg-white placeholder-neutral-500 focus:outline-none focus:placeholder-neutral-400 focus:ring-1 focus:ring-neutral-500 focus:border-neutral-500 sm:text-sm"
          placeholder="Search objects by title..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-neutral-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-200">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Image</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Museum ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Gallery / Collection</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-neutral-200">
              {objects.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-4 text-center text-neutral-500">No objects found.</td></tr>
              ) : objects.map(obj => (
                <tr key={obj.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{obj.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {obj.image_url ? (
                      <img src={obj.image_url} alt={obj.title} className="h-10 w-10 rounded-md object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-neutral-200 flex items-center justify-center text-xs text-neutral-500">N/A</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{obj.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{obj.museum_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    <div>G: {obj.gallery_id || 'None'}</div>
                    <div>C: {obj.collection_id || 'None'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openEditModal(obj)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                      <Edit className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => setDeleteConfirm(obj)} className="text-red-600 hover:text-red-900">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-neutral-200 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold">{editingObject ? 'Edit Object' : 'Add Object'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-neutral-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {formError && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{formError}</div>}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Basic Info</h3>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Title *</label>
                    <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Description</label>
                    <textarea rows="4" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border"></textarea>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Creator</label>
                      <input type="text" value={formData.creator} onChange={e => setFormData({...formData, creator: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Creation Date</label>
                      <input type="text" value={formData.creation_date} onChange={e => setFormData({...formData, creation_date: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Medium</label>
                      <input type="text" value={formData.medium} onChange={e => setFormData({...formData, medium: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700">Dimensions</label>
                      <input type="text" value={formData.dimensions} onChange={e => setFormData({...formData, dimensions: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Organization</h3>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Museum *</label>
                    <select required value={formData.museum_id} onChange={e => setFormData({...formData, museum_id: e.target.value, gallery_id: '', collection_id: ''})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border">
                      <option value="">Select a Museum</option>
                      {museums.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Gallery (Optional)</label>
                    <select value={formData.gallery_id} onChange={e => setFormData({...formData, gallery_id: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" disabled={!formData.museum_id}>
                      <option value="">None</option>
                      {relevantGalleries.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Collection (Optional)</label>
                    <select value={formData.collection_id} onChange={e => setFormData({...formData, collection_id: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" disabled={!formData.museum_id}>
                      <option value="">None</option>
                      {relevantCollections.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <h3 className="font-semibold text-lg border-b pb-2 pt-4">Media</h3>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Image URL</label>
                    <input type="url" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">3D Model URL</label>
                    <input type="url" value={formData.model_3d_url} onChange={e => setFormData({...formData, model_3d_url: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700">Audio URL</label>
                    <input type="url" value={formData.audio_url} onChange={e => setFormData({...formData, audio_url: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-neutral-200 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Object'}
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
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Delete Object</h3>
            <p className="text-sm text-neutral-500 mb-6">Are you sure you want to delete "{deleteConfirm.title}"? This action cannot be undone and will fail if there are dependent learning resources or stories.</p>
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

export default AdminObjects;
