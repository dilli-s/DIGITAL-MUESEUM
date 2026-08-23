import React, { useState, useEffect } from 'react';
import { getAdminMuseums, createAdminMuseum, updateAdminMuseum, deleteAdminMuseum } from '../../services/api';
import { Plus, Edit, Trash2, X, AlertTriangle } from 'lucide-react';

const AdminMuseums = () => {
  const [museums, setMuseums] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMuseum, setEditingMuseum] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', location: '', established_year: '', image_url: '' });
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchMuseums();
  }, []);

  const fetchMuseums = async () => {
    setIsLoading(true);
    try {
      const res = await getAdminMuseums();
      setMuseums(res.data || []);
    } catch (err) {
      setError('Failed to load museums.');
    } finally {
      setIsLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingMuseum(null);
    setFormData({ name: '', description: '', location: '', established_year: '', image_url: '' });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (museum) => {
    setEditingMuseum(museum);
    setFormData({
      name: museum.name || '',
      description: museum.description || '',
      location: museum.location || '',
      established_year: museum.established_year || '',
      image_url: museum.image_url || ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    
    try {
      const payload = {
        ...formData,
        established_year: formData.established_year ? parseInt(formData.established_year) : null
      };

      if (editingMuseum) {
        await updateAdminMuseum(editingMuseum.id, payload);
      } else {
        await createAdminMuseum(payload);
      }
      setIsModalOpen(false);
      fetchMuseums();
    } catch (err) {
      setFormError(err.response?.data?.error?.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAdminMuseum(deleteConfirm.id);
      setDeleteConfirm(null);
      fetchMuseums();
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Failed to delete museum.');
      setDeleteConfirm(null);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-neutral-500">Loading museums...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">Manage Museums</h1>
        <button onClick={openAddModal} className="flex items-center px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800">
          <Plus className="w-5 h-5 mr-2" /> Add Museum
        </button>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Location</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {museums.length === 0 ? (
              <tr><td colSpan="4" className="px-6 py-4 text-center text-neutral-500">No museums found.</td></tr>
            ) : museums.map(museum => (
              <tr key={museum.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{museum.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{museum.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{museum.location}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => openEditModal(museum)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                    <Edit className="w-4 h-4 inline" />
                  </button>
                  <button onClick={() => setDeleteConfirm(museum)} className="text-red-600 hover:text-red-900">
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
              <h2 className="text-xl font-bold">{editingMuseum ? 'Edit Museum' : 'Add Museum'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-400 hover:text-neutral-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-neutral-700">Name *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Location *</label>
                <input type="text" required value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Description</label>
                <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Established Year</label>
                <input type="number" value={formData.established_year} onChange={e => setFormData({...formData, established_year: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Image URL</label>
                <input type="url" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
              </div>
              <div className="pt-4 flex justify-end space-x-3 border-t border-neutral-200 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-neutral-300 rounded-md text-neutral-700 hover:bg-neutral-50">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Museum'}
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
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Delete Museum</h3>
            <p className="text-sm text-neutral-500 mb-6">Are you sure you want to delete "{deleteConfirm.name}"? This action cannot be undone and will fail if the museum has dependent galleries or objects.</p>
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

export default AdminMuseums;
