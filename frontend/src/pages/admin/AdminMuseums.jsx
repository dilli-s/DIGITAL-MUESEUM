import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getAdminMuseums, createAdminMuseum, updateAdminMuseum, deleteAdminMuseum, uploadFile } from '../../services/api';
import { Plus, Edit, Trash2, X, AlertTriangle, MapPin } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

const AdminMuseums = () => {
  const [museums, setMuseums] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMuseum, setEditingMuseum] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', description: '', location: '', established_year: '', image_url: '',
    entrance_lat: '', entrance_lng: '', exit_lat: '', exit_lng: '',
    washroom_lat: '', washroom_lng: '', cafe_lat: '', cafe_lng: '', pathing_graph: { nodes: {}, edges: [] },
    floorplan_image: ''
  });
  const [activePinMode, setActivePinMode] = useState('main'); // 'main', 'entrance', 'exit', 'washroom', 'cafe', 'pathing'
  const [selectedPathingNode, setSelectedPathingNode] = useState(null);
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchMuseums();
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const res = await uploadFile(file);
      if (res.data && res.data.url) {
        setFormData(prev => ({ ...prev, image_url: res.data.url }));
      }
    } catch (err) {
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFloorplanUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadFile(file);
      if (res.data && res.data.url) {
        setFormData(prev => ({ ...prev, floorplan_image: res.data.url }));
      }
    } catch (err) {
      alert('Failed to upload floorplan image.');
    } finally {
      setIsUploading(false);
    }
  };

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

  const handleImageClick = (e) => {
    if (!formData.floorplan_image) return;
    const rect = e.target.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const lat = y.toFixed(2);
    const lng = x.toFixed(2);

    if (activePinMode === 'main') {
      setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
    } else if (activePinMode === 'pathing') {
      const newNodeId = `n_${Date.now()}`;
      setFormData(prev => {
          const g = prev.pathing_graph || { nodes: {}, edges: [] };
          const newNodes = { ...g.nodes, [newNodeId]: { lat, lng } };
          const newEdges = [...g.edges];
          if (selectedPathingNode && g.nodes[selectedPathingNode]) {
            newEdges.push([selectedPathingNode, newNodeId]);
          }
          return { ...prev, pathing_graph: { nodes: newNodes, edges: newEdges } };
      });
      setSelectedPathingNode(newNodeId);
    } else {
      setFormData(prev => ({ ...prev, [`${activePinMode}_lat`]: lat, [`${activePinMode}_lng`]: lng }));
    }
  };

  const handleDetectCoordinates = async () => {
    if (!formData.location) return;
    setIsDetecting(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(formData.location)}&format=json&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setFormData(prev => ({
          ...prev,
          latitude: data[0].lat,
          longitude: data[0].lon
        }));
      } else {
        alert('Could not detect coordinates for this location.');
      }
    } catch (err) {
      alert('Error detecting coordinates.');
    } finally {
      setIsDetecting(false);
    }
  };

  const openAddModal = () => {
    setEditingMuseum(null);
    setFormData({ 
      name: '', description: '', location: '', latitude: '', longitude: '', established_year: '', image_url: '',
      entrance_lat: '', entrance_lng: '', exit_lat: '', exit_lng: '',
      washroom_lat: '', washroom_lng: '', cafe_lat: '', cafe_lng: '', pathing_graph: { nodes: {}, edges: [] },
      floorplan_image: '',
      opening_hours: '', contact_email: '', contact_phone: '', wheelchair_access: false, info_desk: false, cafe_restrooms: false
    });
    setActivePinMode('main');
    setSelectedPathingNode(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (museum) => {
    setEditingMuseum(museum);
    setFormData({
      name: museum.name || '',
      description: museum.description || '',
      location: museum.location || '',
      latitude: museum.latitude || '',
      longitude: museum.longitude || '',
      entrance_lat: museum.entrance_lat || '',
      entrance_lng: museum.entrance_lng || '',
      exit_lat: museum.exit_lat || '',
      exit_lng: museum.exit_lng || '',
      washroom_lat: museum.washroom_lat || '',
      washroom_lng: museum.washroom_lng || '',
      cafe_lat: museum.cafe_lat || '',
      cafe_lng: museum.cafe_lng || '',
      established_year: museum.established_year || '',
      image_url: museum.image_url || '',
      opening_hours: museum.opening_hours || '',
      contact_email: museum.contact_email || '',
      contact_phone: museum.contact_phone || '',
      wheelchair_access: museum.wheelchair_access || false,
      info_desk: museum.info_desk || false,
      cafe_restrooms: museum.cafe_restrooms || false,
      pathing_graph: museum.pathing_graph || { nodes: {}, edges: [] },
      floorplan_image: museum.floorplan_image || '',
      bounds_tl_lat: museum.bounds_tl_lat || '',
      bounds_tl_lng: museum.bounds_tl_lng || '',
      bounds_br_lat: museum.bounds_br_lat || '',
      bounds_br_lng: museum.bounds_br_lng || ''
    });
    setActivePinMode('main');
    setSelectedPathingNode(null);
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
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">QR Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Location</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-neutral-200">
            {museums.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-4 text-center text-neutral-500">No museums found.</td></tr>
            ) : museums.map(museum => (
              <tr key={museum.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">{museum.id}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="bg-white p-1 rounded-md border border-neutral-200 inline-block">
                    <QRCodeCanvas value={`${window.location.origin}/museums/${museum.id}`} size={64} level="M" />
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{museum.name}</td>
                <td className="px-6 py-4 max-w-xs truncate text-sm text-neutral-500" title={museum.location}>{museum.location}</td>
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
              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-neutral-900">Indoor Mapping Facilities</label>
                  <button 
                    type="button" 
                    onClick={handleDetectCoordinates}
                    disabled={isDetecting || !formData.location}
                    className="text-xs flex items-center bg-white px-3 py-1.5 rounded-md border border-neutral-300 text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5 mr-1.5" />
                    {isDetecting ? 'Detecting...' : 'Auto-detect main from Location text'}
                  </button>
                </div>
                
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-neutral-900 mb-2">Upload Floorplan Image</label>
                    <input type="file" accept="image/*" onChange={handleFloorplanUpload} className="block w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-neutral-900 file:text-white hover:file:bg-neutral-800" disabled={isUploading} />
                    {formData.floorplan_image && <p className="text-xs text-emerald-600 mt-2 font-bold">✓ Floorplan Uploaded</p>}
                  </div>
                </div>

                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                  {['main', 'entrance', 'exit', 'washroom', 'cafe', 'pathing'].map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setActivePinMode(mode)}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold border transition-colors whitespace-nowrap ${activePinMode === mode ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm' : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100'}`}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1) + ' Pin'}
                    </button>
                  ))}
                </div>

                  <div className="w-full h-[500px] rounded-md overflow-hidden border border-neutral-200 bg-neutral-100 mb-4 relative shadow-inner">
                    <div className="absolute top-2 left-2 z-10 bg-white/95 backdrop-blur px-3 py-1.5 rounded-md text-xs font-bold text-neutral-700 shadow-md pointer-events-none border border-neutral-100 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      {activePinMode === 'pathing' ? (selectedPathingNode ? 'Click image to place node, or click another node to connect' : 'Click image to place pathing node') : `Click image to place ${activePinMode} pin`}
                    </div>
                    {activePinMode === 'pathing' && (
                      <div className="absolute top-2 right-2 z-10">
                         <button type="button" onClick={() => setFormData(p => ({ ...p, pathing_graph: { nodes: {}, edges: [] } }))} className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded hover:bg-red-200">Clear Graph</button>
                      </div>
                    )}
                    {formData.floorplan_image ? (
                      <div className="w-full h-full relative cursor-crosshair">
                        <img 
                           src={formData.floorplan_image} 
                           alt="Floorplan" 
                           className="w-full h-full object-contain pointer-events-none opacity-50" 
                        />
                        <div 
                           className="absolute inset-0"
                           onClick={handleImageClick}
                        >
                           {/* Render pathing edges */}
                           <svg className="absolute inset-0 w-full h-full pointer-events-none">
                              {formData.pathing_graph && (formData.pathing_graph.edges || []).map((edge, i) => {
                                 const n1 = formData.pathing_graph.nodes[edge[0]];
                                 const n2 = formData.pathing_graph.nodes[edge[1]];
                                 if (n1 && n2) {
                                    return <line key={i} x1={`${n1.lng}%`} y1={`${n1.lat}%`} x2={`${n2.lng}%`} y2={`${n2.lat}%`} stroke="#005f73" strokeWidth="2" />
                                 }
                                 return null;
                              })}
                           </svg>

                           {/* Render pins */}
                           {formData.latitude && formData.longitude && (
                             <div className="absolute w-5 h-5 bg-purple-500 rounded-full border-2 border-white -ml-2.5 -mt-2.5 shadow pointer-events-none flex items-center justify-center text-[8px] text-white font-bold" style={{ left: `${formData.longitude}%`, top: `${formData.latitude}%` }}>M</div>
                           )}
                           {formData.entrance_lat && formData.entrance_lng && (
                             <div className="absolute w-5 h-5 bg-green-500 rounded-full border-2 border-white -ml-2.5 -mt-2.5 shadow pointer-events-none flex items-center justify-center text-[8px] text-white font-bold" style={{ left: `${formData.entrance_lng}%`, top: `${formData.entrance_lat}%` }}>En</div>
                           )}
                           {formData.exit_lat && formData.exit_lng && (
                             <div className="absolute w-5 h-5 bg-red-500 rounded-full border-2 border-white -ml-2.5 -mt-2.5 shadow pointer-events-none flex items-center justify-center text-[8px] text-white font-bold" style={{ left: `${formData.exit_lng}%`, top: `${formData.exit_lat}%` }}>Ex</div>
                           )}
                           {formData.washroom_lat && formData.washroom_lng && (
                             <div className="absolute w-5 h-5 bg-blue-500 rounded-full border-2 border-white -ml-2.5 -mt-2.5 shadow pointer-events-none flex items-center justify-center text-[8px] text-white font-bold" style={{ left: `${formData.washroom_lng}%`, top: `${formData.washroom_lat}%` }}>W</div>
                           )}
                           {formData.cafe_lat && formData.cafe_lng && (
                             <div className="absolute w-5 h-5 bg-orange-500 rounded-full border-2 border-white -ml-2.5 -mt-2.5 shadow pointer-events-none flex items-center justify-center text-[8px] text-white font-bold" style={{ left: `${formData.cafe_lng}%`, top: `${formData.cafe_lat}%` }}>C</div>
                           )}
                           
                           {/* Render pathing nodes */}
                           {formData.pathing_graph && Object.entries(formData.pathing_graph.nodes || {}).map(([nodeId, coords]) => (
                             <div 
                               key={nodeId}
                               className={`absolute w-3 h-3 rounded-full border border-white -ml-1.5 -mt-1.5 cursor-pointer shadow ${selectedPathingNode === nodeId ? 'bg-red-500 z-20 scale-125' : 'bg-black z-10'}`}
                               style={{ left: `${coords.lng}%`, top: `${coords.lat}%` }}
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (activePinMode === 'pathing') {
                                   if (selectedPathingNode && selectedPathingNode !== nodeId) {
                                      setFormData(p => {
                                         const g = p.pathing_graph;
                                         const edgeExists = g.edges.some(e => (e[0] === selectedPathingNode && e[1] === nodeId) || (e[0] === nodeId && e[1] === selectedPathingNode));
                                         if (!edgeExists) {
                                            return { ...p, pathing_graph: { ...g, edges: [...g.edges, [selectedPathingNode, nodeId]] } };
                                         }
                                         return p;
                                      });
                                   }
                                   setSelectedPathingNode(nodeId);
                                 }
                               }}
                             />
                           ))}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-sm text-neutral-400">
                        Upload a floorplan image to start mapping manually
                      </div>
                    )}
                  </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1 capitalize">{activePinMode} Latitude</label>
                    <input type="number" step="any" value={activePinMode === 'main' ? formData.latitude : formData[`${activePinMode}_lat`]} onChange={e => {
                      if (activePinMode === 'main') setFormData({...formData, latitude: e.target.value});
                      else setFormData({...formData, [`${activePinMode}_lat`]: e.target.value});
                    }} className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border bg-white" placeholder="e.g. 28.6139" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1 capitalize">{activePinMode} Longitude</label>
                    <input type="number" step="any" value={activePinMode === 'main' ? formData.longitude : formData[`${activePinMode}_lng`]} onChange={e => {
                      if (activePinMode === 'main') setFormData({...formData, longitude: e.target.value});
                      else setFormData({...formData, [`${activePinMode}_lng`]: e.target.value});
                    }} className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border bg-white" placeholder="e.g. 77.2090" />
                  </div>
                </div>
              </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Description</label>
                <textarea rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Established Year</label>
                <input type="number" value={formData.established_year} onChange={e => setFormData({...formData, established_year: e.target.value})} className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700">Opening Hours</label>
                  <input type="text" value={formData.opening_hours} onChange={e => setFormData({...formData, opening_hours: e.target.value})} placeholder="e.g. Mon-Sun: 10AM - 6PM" className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700">Contact Email</label>
                  <input type="email" value={formData.contact_email} onChange={e => setFormData({...formData, contact_email: e.target.value})} placeholder="e.g. info@museum.com" className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700">Contact Phone</label>
                  <input type="text" value={formData.contact_phone} onChange={e => setFormData({...formData, contact_phone: e.target.value})} placeholder="e.g. +1 (555) 123-4567" className="mt-1 block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" />
                </div>
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-900 mb-3 border-b pb-2">Global GPS Bounding Box</h4>
                <p className="text-xs text-neutral-500 mb-4">Set these to perfectly map real-world GPS to the floorplan image.</p>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Top-Left Latitude</label>
                    <input type="number" step="any" value={formData.bounds_tl_lat} onChange={e => setFormData({...formData, bounds_tl_lat: e.target.value})} className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border bg-white" placeholder="e.g. 28.6145" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Top-Left Longitude</label>
                    <input type="number" step="any" value={formData.bounds_tl_lng} onChange={e => setFormData({...formData, bounds_tl_lng: e.target.value})} className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border bg-white" placeholder="e.g. 77.2080" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Bottom-Right Latitude</label>
                    <input type="number" step="any" value={formData.bounds_br_lat} onChange={e => setFormData({...formData, bounds_br_lat: e.target.value})} className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border bg-white" placeholder="e.g. 28.6135" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">Bottom-Right Longitude</label>
                    <input type="number" step="any" value={formData.bounds_br_lng} onChange={e => setFormData({...formData, bounds_br_lng: e.target.value})} className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border bg-white" placeholder="e.g. 77.2100" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">Facilities</label>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center">
                    <input type="checkbox" checked={formData.wheelchair_access} onChange={e => setFormData({...formData, wheelchair_access: e.target.checked})} className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900" />
                    <span className="ml-2 text-sm text-neutral-700">Wheelchair Access</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="checkbox" checked={formData.info_desk} onChange={e => setFormData({...formData, info_desk: e.target.checked})} className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900" />
                    <span className="ml-2 text-sm text-neutral-700">Information Desk</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="checkbox" checked={formData.cafe_restrooms} onChange={e => setFormData({...formData, cafe_restrooms: e.target.checked})} className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900" />
                    <span className="ml-2 text-sm text-neutral-700">Cafe & Restrooms</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700">Image</label>
                <div className="mt-1 flex items-center space-x-4">
                  <input type="url" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} className="block w-full rounded-md border-neutral-300 shadow-sm focus:border-neutral-500 focus:ring-neutral-500 p-2 border" placeholder="Image URL" />
                  <span className="text-neutral-500 text-sm">OR</span>
                  <label className="cursor-pointer bg-neutral-100 border border-neutral-300 hover:bg-neutral-200 text-neutral-700 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap">
                    {isUploading ? 'Uploading...' : 'Upload File'}
                    <input type="file" accept="image/*,video/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
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
