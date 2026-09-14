import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminGalleries, createAdminGallery, updateAdminGallery, deleteAdminGallery, getAdminMuseums, uploadFile } from '../../services/api';
import { Plus, Edit, Trash2, X, AlertTriangle, MapPin, Eye, Upload } from 'lucide-react';
import GenericCsvImporter from '../../components/admin/GenericCsvImporter';

// Mini SVG polygon preview for boundary shapes
const PolygonMiniMap = ({ points, size = 64 }) => {
  if (!points || points.length < 3) return null;
  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const pad = 4;
  const rangeW = maxLng - minLng || 0.0001;
  const rangeH = maxLat - minLat || 0.0001;
  const scale = Math.min((size - pad * 2) / rangeW, (size - pad * 2) / rangeH);
  const svgPts = points.map(p => {
    const x = (p.lng - minLng) * scale + pad;
    const y = (maxLat - p.lat) * scale + pad; // flip Y
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded border border-neutral-200 bg-slate-50">
      <polygon points={svgPts} fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5" />
    </svg>
  );
};

const AdminGalleries = () => {
  const navigate = useNavigate();
  const [galleries, setGalleries] = useState([]);
  const [museums, setMuseums] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGallery, setEditingGallery] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', museum_id: '', floor: '1', image_url: '' });
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [museumFilter, setMuseumFilter] = useState('');
  const [floorFilter, setFloorFilter] = useState('');

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
      console.log('Failed to upload file. Please try again.');
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
        getAdminGalleries(museumFilter ? { museum_id: museumFilter } : {}),
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

  const fetchGalleries = async (mFilter = museumFilter) => {
    try {
      const params = mFilter ? { museum_id: mFilter } : {};
      const res = await getAdminGalleries(params);
      setGalleries(res.data || []);
    } catch (err) {
      console.log(err);
    }
  };

  const handleMuseumFilterChange = (mId) => {
    setMuseumFilter(mId);
    fetchGalleries(mId);
  };

  const openAddModal = () => {
    setEditingGallery(null);
    setFormData({ name: '', description: '', museum_id: museumFilter || (museums.length > 0 ? museums[0].id : ''), floor: '1', image_url: '' });
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
      if (!payload.name || !payload.name.trim()) {
        throw new Error("Room name is required");
      }
      if (!payload.museum_id) {
        throw new Error("Museum is required");
      }
      payload.museum_id = parseInt(payload.museum_id);
      if (!payload.floor || !payload.floor.trim()) payload.floor = '1';
      
      if (editingGallery) {
        await updateAdminGallery(editingGallery.id, payload);
        setIsModalOpen(false);
        fetchGalleries();
      } else {
        // Create the gallery, then redirect to draw its boundary
        const res = await createAdminGallery(payload);
        const newGalleryId = res?.data?.id;
        setIsModalOpen(false);
        await fetchGalleries();
        if (newGalleryId) {
          // Redirect to boundary drawing tool pre-selecting the new room
          navigate(`/admin/coordinates?tab=boundaries&gallery_id=${newGalleryId}`);
        }
      }
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
      console.log(err.response?.data?.error?.message || 'Failed to delete gallery.');
      setDeleteConfirm(null);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-neutral-500">Loading galleries...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-neutral-900">Manage Galleries</h1>
        <div className="flex items-center space-x-3">
          <select
            value={museumFilter}
            onChange={(e) => handleMuseumFilterChange(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white text-neutral-800 shadow-xs focus:ring-neutral-500 focus:border-neutral-500 font-medium"
          >
            <option value="">All Museums ({museums.length})</option>
            {museums.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            className="border border-neutral-300 rounded-md px-3 py-2 text-sm bg-white text-neutral-800 shadow-xs focus:ring-neutral-500 focus:border-neutral-500 font-medium"
          >
            <option value="">All Floors</option>
            <option value="0">Ground Floor (0)</option>
            <option value="1">Floor 1</option>
            <option value="2">Floor 2</option>
            <option value="3">Floor 3</option>
            <option value="4">Floor 4</option>
          </select>
          <button 
            onClick={() => setIsCsvModalOpen(true)} 
            className="flex items-center px-4 py-2 border border-neutral-300 bg-white text-neutral-800 rounded-md hover:bg-neutral-50 font-medium text-sm shadow-xs transition"
          >
            <Upload className="w-4 h-4 mr-2 text-indigo-600" /> Bulk Import CSV
          </button>
          <button onClick={openAddModal} className="flex items-center px-4 py-2 bg-neutral-900 text-white rounded-md hover:bg-neutral-800 text-sm font-medium">
            <Plus className="w-5 h-5 mr-2" /> Add Gallery
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Museum ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Floor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Boundary Shape Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {galleries.filter(g => !floorFilter || String(g.floor) === String(floorFilter) || (floorFilter === '0' && String(g.floor).toLowerCase().includes('ground'))).length === 0 ? (
              <tr><td colSpan="6" className="px-6 py-4 text-center text-neutral-500">No galleries found for the selected filter.</td></tr>
            ) : galleries.filter(g => !floorFilter || String(g.floor) === String(floorFilter) || (floorFilter === '0' && String(g.floor).toLowerCase().includes('ground'))).map(gallery => {
              const hasShape = gallery.boundary_polygon && gallery.boundary_polygon.length >= 3;
              return (
                <tr key={gallery.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{gallery.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{gallery.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">
                    {museums.find(m => String(m.id) === String(gallery.museum_id))?.name || `#${gallery.museum_id}`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">Floor {gallery.floor}</td>
                  <td className="px-6 py-4 text-xs">
                    {hasShape ? (
                      <div className="flex items-center gap-3">
                        <PolygonMiniMap points={gallery.boundary_polygon} size={56} />
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            ✓ {gallery.boundary_polygon.length} corners
                          </span>
                          <button
                            onClick={() => navigate(`/admin/coordinates?tab=boundaries&gallery_id=${gallery.id}`)}
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                          >
                            <Eye className="w-3 h-3" /> View / Edit Shape
                          </button>
                        </div>
                      </div>
                    ) : (
                      <a
                        href={`/admin/coordinates?tab=boundaries&gallery_id=${gallery.id}`}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 hover:bg-red-200 transition"
                      >
                        ⚠️ Draw Room Boundary &rarr;
                      </a>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openEditModal(gallery)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                      <Edit className="w-4 h-4 inline" />
                    </button>
                    <button onClick={() => setDeleteConfirm(gallery)} className="text-red-600 hover:text-red-900">
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              );
            })}
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
                <label className="block text-sm font-medium text-neutral-700">Floor Number *</label>
                <select
                  value={formData.floor}
                  onChange={e => setFormData({...formData, floor: e.target.value})}
                  className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border"
                >
                  <option value="0">Ground Floor (0)</option>
                  <option value="1">Floor 1</option>
                  <option value="2">Floor 2</option>
                  <option value="3">Floor 3</option>
                  <option value="4">Floor 4</option>
                </select>
              </div>
              {!editingGallery && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-start gap-2">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
                  <span><strong>After saving</strong>, you'll be taken directly to the map to draw this room's boundary polygon.</span>
                </div>
              )}
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

      {/* CSV Bulk Importer Modal */}
      <GenericCsvImporter
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        entityType="galleries"
        existingItems={galleries}
        createItem={createAdminGallery}
        updateItem={updateAdminGallery}
        onSuccess={fetchGalleries}
        defaultContext={museums.length > 0 ? { museum_id: museums[0].id } : {}}
      />
    </div>
  );
};

export default AdminGalleries;
