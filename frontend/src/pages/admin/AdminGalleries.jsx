import React, { useState, useEffect } from 'react';
import { getAdminGalleries, createAdminGallery, updateAdminGallery, deleteAdminGallery, getAdminMuseums, uploadFile } from '../../services/api';
import { Plus, Edit, Trash2, X, AlertTriangle } from 'lucide-react';

const AdminGalleries = () => {
  const [galleries, setGalleries] = useState([]);
  const [museums, setMuseums] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGallery, setEditingGallery] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', museum_id: '', floor: '', image_url: '' });
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const handleUpload = async (e, field) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const res = await uploadFile(file);
      if (res.data && res.data.url) {
        setFormData(prev => ({ ...prev, [field]: res.data.url }));
      }
    } catch (err) {
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const [galsRes, musRes] = await Promise.all([
        getAdminGalleries(),
        getAdminMuseums()
      ]);
      setGalleries(galsRes.data || []);
      setMuseums(musRes.data || []);
    } catch (err) {
      setError('Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGalleries = async () => {
    try {
      const res = await getAdminGalleries();
      setGalleries(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const openAddModal = () => {
    setEditingGallery(null);
    setFormData({ name: '', description: '', museum_id: museums.length > 0 ? museums[0].id : '', floor: '', image_url: '' });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (gallery) => {
    setEditingGallery(gallery);
    setFormData({
      name: gallery.name || '',
      description: gallery.description || '',
      museum_id: gallery.museum_id || '',
      floor: gallery.floor || '',
      image_url: gallery.image_url || ''
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
      
      if (editingGallery) {
        await updateAdminGallery(editingGallery.id, payload);
      } else {
        await createAdminGallery(payload);
      }
      setIsModalOpen(false);
      fetchGalleries();
    } catch (err) {
      setFormError(err.message || err.response?.data?.error?.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAdminGallery(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchGalleries();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete gallery.');
      setDeleteConfirm(null);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-neutral-500">Loading galleries...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">Manage Galleries</h1>
        <button onClick={openAddModal} className="flex items-center px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800">
          <Plus className="w-5 h-5 mr-2" /> Add Gallery
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Museum ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Floor</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {galleries.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-4 text-center text-neutral-500">No galleries found.</td></tr>
            ) : galleries.map(gallery => (
              <tr key={gallery.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{gallery.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{gallery.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{gallery.museum_id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{gallery.floor}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => openEditModal(gallery)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                    <Edit className="w-4 h-4 inline" />
                  </button>
                  <button onClick={() => setDeleteConfirm(gallery)} className="text-red-600 hover:text-red-900">
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
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-neutral-200">
              <h2 className="text-xl font-bold">{editingGallery ? 'Edit Gallery' : 'Add Gallery'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-neutral-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-neutral-700">Name *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Museum *</label>
                <select required value={formData.museum_id} onChange={e => setFormData({...formData, museum_id: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border">
                  <option value="">Select a Museum</option>
                  {museums.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Description</label>
                <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Floor</label>
                <input type="text" value={formData.floor} onChange={e => setFormData({...formData, floor: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Image</label>
                <div className="mt-1 flex items-center space-x-4">
                  <input type="url" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" placeholder="Image URL" />
                  <span className="text-neutral-500 text-sm">OR</span>
                  <label className="cursor-pointer bg-neutral-100 border border-neutral-300 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap">
                    {isUploading ? 'Uploading...' : 'Upload File'}
                    <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleUpload(e, 'image_url')} disabled={isUploading} />
                  </label>
                </div>
                {formData.image_url && (
                  <div className="mt-2">
                    <img src={formData.image_url} alt="Preview" className="h-20 object-cover rounded border border-neutral-200" onError={(e) => e.target.style.display = 'none'} />
                  </div>
                )}
              </div>
              <div className="pt-4 flex justify-end space-x-3 border-t border-neutral-200 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Gallery'}
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
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Delete Gallery</h3>
            <p className="text-sm text-neutral-500 mb-6">Are you sure you want to delete "{deleteConfirm.name}"? This action cannot be undone and will fail if there are dependent objects or collections.</p>
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

export default AdminGalleries;
