/**
 * AdminVirtualTour — Intuitive 360° Tour Studio & Marker Placement Tool.
 *
 * Designed for museum staff to easily create Google Street View-style
 * virtual tours with two clear, distinct marker types:
 * 1. 🚶‍♂️ Walkway Arrows (Edges) — connect to adjacent 360° waypoints for movement.
 * 2. 🏺 Artifact Hotspots (Objects) — tag real museum artifacts to open info cards in-place.
 */

import React, {
  useState, useEffect, useRef, useCallback, useLayoutEffect
} from 'react';
import axios from 'axios';
import API_BASE_URL from '../../config/api';
import { Viewer } from '@photo-sphere-viewer/core';
import { MarkersPlugin } from '@photo-sphere-viewer/markers-plugin';
import '@photo-sphere-viewer/core/index.css';
import '@photo-sphere-viewer/markers-plugin/index.css';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
});

const RAD = 180 / Math.PI; // radians → degrees
const fmt = (v, d = 1) => (typeof v === 'number' ? v.toFixed(d) : '—');

function getFullUrl(url) {
  if (!url || typeof url !== 'string' || url.includes('undefined')) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (url.includes(':5000/uploads/')) {
      return url.substring(url.indexOf('/uploads/'));
    }
    if (url.includes(':5000/api/')) {
      return url.substring(url.indexOf('/api/'));
    }
    return url;
  }
  return url.startsWith('/') ? url : `/${url}`;
}

const AdminVirtualTour = () => {
  // ── Museum & Node Selection ────────────────────────────────────────────────
  const [museums, setMuseums] = useState([]);
  const [selectedMuseumId, setSelectedMuseumId] = useState('');
  const [nodes, setNodes] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── UI States ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { text, type: 'ok'|'err' }
  const [rightTab, setRightTab] = useState('edges'); // 'edges' | 'objects' | 'node'
  const [showAdvancedAngles, setShowAdvancedAngles] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showNewNodeModal, setShowNewNodeModal] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  
  // Placement Mode: 'walkway' | 'artifact' | 'view'
  const [placementMode, setPlacementMode] = useState('walkway');

  // ── PSV Viewer & Markers ───────────────────────────────────────────────────
  const psvContainerRef = useRef(null);
  const viewerRef = useRef(null);
  const markersRef = useRef(null);

  // ── Clicked Target Position & Quick Popover ─────────────────────────────────
  const [clickedPos, setClickedPos] = useState(null); // { yaw, pitch } in degrees
  const [showQuickPopup, setShowQuickPopup] = useState(false);
  const [quickPopupTab, setQuickPopupTab] = useState('walkway'); // 'walkway' | 'artifact'

  // ── Node Form ──────────────────────────────────────────────────────────────
  const [nodeForm, setNodeForm] = useState({
    name: '',
    description: '',
    gallery_id: '',
    compass_bearing_ref: '',
    pos_x: '',
    pos_y: '',
    is_start: false
  });
  const [uploadingPano, setUploadingPano] = useState(false);

  // ── Edge (Walkway Arrow) State ─────────────────────────────────────────────
  const [edges, setEdges] = useState([]);
  const [newEdge, setNewEdge] = useState({
    target_node_id: '',
    yaw: '0',
    pitch: '-10',
    facing_yaw: '180',
    target_entry_yaw: '0',
    label: '',
    create_return_edge: true,
  });

  // ── Object (Artifact Hotspot) State ────────────────────────────────────────
  const [nodeObjects, setNodeObjects] = useState([]);
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [objectForm, setObjectForm] = useState({});
  const [addObjectId, setAddObjectId] = useState('');
  const [allMuseumObjects, setAllMuseumObjects] = useState([]);

  const notify = (text, type = 'ok') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };

  // ── 1. Load Museums & Auto-select First ─────────────────────────────────────
  useEffect(() => {
    api.get('/admin/museums')
      .then(r => {
        const list = r.data.data || [];
        setMuseums(list);
        if (list.length > 0 && !selectedMuseumId) {
          setSelectedMuseumId(String(list[0].id));
        }
      })
      .catch(console.error);
  }, []); // eslint-disable-line

  // ── 2. Load Nodes when Museum changes & Auto-select Start Node ───────────────
  useEffect(() => {
    if (!selectedMuseumId) {
      setNodes([]);
      setSelectedNode(null);
      return;
    }
    api.get(`/admin/tour/nodes?museum_id=${selectedMuseumId}`)
      .then(r => {
        const list = r.data.data || [];
        setNodes(list);
        if (list.length > 0) {
          const start = list.find(n => n.is_start) || list[0];
          setSelectedNode(start);
        } else {
          setSelectedNode(null);
        }
      })
      .catch(console.error);

    api.get(`/admin/objects?museum_id=${selectedMuseumId}`)
      .then(r => setAllMuseumObjects(r.data.data || []))
      .catch(console.error);
  }, [selectedMuseumId]);

  // ── 3. Load Node Detail when Selected ──────────────────────────────────────
  useEffect(() => {
    if (!selectedNode) {
      setEdges([]);
      setNodeObjects([]);
      setObjectForm({});
      setClickedPos(null);
      setShowQuickPopup(false);
      return;
    }

    setNodeForm({
      name: selectedNode.name || '',
      description: selectedNode.description || '',
      gallery_id: selectedNode.gallery_id || '',
      compass_bearing_ref: selectedNode.compass_bearing_ref ?? '',
      pos_x: selectedNode.pos_x ?? '',
      pos_y: selectedNode.pos_y ?? '',
      is_start: selectedNode.is_start || false,
    });

    api.get(`/admin/tour/nodes/${selectedNode.id}`)
      .then(r => {
        const fetchedEdges = r.data.data.edges || [];
        const objs = r.data.data.objects || [];
        setEdges(fetchedEdges);
        setNodeObjects(objs);
        if (objs.length > 0 && !selectedObjectId) {
          setSelectedObjectId(objs[0].id);
        }
      })
      .catch(console.error);
  }, [selectedNode?.id]); // eslint-disable-line

  // ── 4. Load Selected Object Detail ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedObjectId) {
      setObjectForm({});
      return;
    }
    api.get(`/admin/objects/${selectedObjectId}`)
      .then(r => {
        const o = r.data.data;
        setObjectForm({
          name: o.name || '',
          category: o.category || '',
          period: o.period || '',
          origin: o.origin || '',
          provenance: o.provenance || '',
          materials: o.materials || '',
          dimensions: o.dimensions || '',
          description: o.description || '',
          tour_node_id: o.tour_node_id || selectedNode?.id || '',
          tour_yaw: o.tour_yaw ?? '',
          tour_pitch: o.tour_pitch ?? '',
          angle_photos: o.angle_photos || [],
          custom_fields: o.custom_fields || [],
          image: o.image || '',
        });
      })
      .catch(console.error);
  }, [selectedObjectId]); // eslint-disable-line

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  // ── 5. Initialize PSV Viewer & Click Handling ──────────────────────────────
  useLayoutEffect(() => {
    if (!psvContainerRef.current || !selectedNode?.panorama_url) return;

    const panoUrl = getFullUrl(selectedNode.panorama_url);
    if (!panoUrl) return;

    if (viewerRef.current) {
      viewerRef.current.setPanorama(panoUrl, {
        transition: { effect: 'fade', speed: 400 },
        showLoader: false,
      }).then(() => {
        renderMarkersOnPSV(edgesRef.current, nodeObjects);
      }).catch(err => console.error('Admin pano switch error:', err));
      return;
    }

    const viewer = new Viewer({
      container: psvContainerRef.current,
      panorama: panoUrl,
      navbar: false,
      plugins: [[MarkersPlugin, {}]],
    });
    viewerRef.current = viewer;
    markersRef.current = viewer.getPlugin(MarkersPlugin);

    // Click anywhere on panorama -> Drop crosshair target and open quick action popover
    viewer.addEventListener('click', async ({ data }) => {
      const yawDeg = data.yaw * RAD;
      const pitchDeg = data.pitch * RAD;
      setClickedPos({ yaw: yawDeg, pitch: pitchDeg });
      setShowQuickPopup(true);

      // Auto-populate active forms
      setNewEdge(p => ({
        ...p,
        yaw: String(yawDeg.toFixed(1)),
        pitch: String(pitchDeg.toFixed(1)),
        facing_yaw: String(((yawDeg + 180) % 360).toFixed(1)),
        target_entry_yaw: String(yawDeg.toFixed(1))
      }));
      setObjectForm(p => ({
        ...p,
        tour_yaw: String(yawDeg.toFixed(1)),
        tour_pitch: String(pitchDeg.toFixed(1)),
      }));

      // Drop visual crosshair at clicked position
      if (markersRef.current) {
        markersRef.current.clearMarkers();
        markersRef.current.addMarker({
          id: 'crosshair',
          html: `<div style="width:30px;height:30px;border:3px solid #dfb758;border-radius:50%;background:rgba(223,183,88,0.4);box-shadow:0 0 16px rgba(223,183,88,0.9);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:900;animation:pulse 1.5s infinite;">🎯</div>`,
          position: { yaw: data.yaw, pitch: data.pitch },
          anchor: 'center center',
        });
        renderMarkersOnPSV(edgesRef.current, nodeObjects);
      }
    });

    // Marker click handlers
    const handleAdminEdgeClick = async (edge) => {
      const targetId = edge.target_node_id;
      const targetNode = nodesRef.current.find(n => n.id === targetId);
      if (targetNode && viewerRef.current) {
        try {
          const yawRad = (edge.yaw || 0) * (Math.PI / 180);
          const pitchRad = (edge.pitch || -10) * (Math.PI / 180);

          await viewerRef.current.animate({ yaw: yawRad, pitch: pitchRad, zoom: 65, speed: '300ms' });
        } catch (e) {}
        setSelectedNode(targetNode);
      }
    };

    const handleAdminObjectClick = (obj) => {
      setSelectedObjectId(obj.id);
      setRightTab('objects');
    };

    markersRef.current.addEventListener('select-marker', async ({ marker }) => {
      const data = marker.config?.data;
      if (data?.type === 'edge' && data.edge) {
        handleAdminEdgeClick(data.edge);
      } else if (data?.type === 'object' && data.object) {
        handleAdminObjectClick(data.object);
      }
    });

    return () => {
      // Viewer cleaned up only on total unmount if container unmounts
    };
  }, [selectedNode?.id, selectedNode?.panorama_url]); // eslint-disable-line

  // ── Render Markers on PSV ──────────────────────────────────────────────────
  const renderMarkersOnPSV = useCallback((edgeList, objList) => {
    if (!markersRef.current) return;
    markersRef.current.clearMarkers();

    // 1. Walkway Arrow Markers (Navigation)
    edgeList.forEach(edge => {
      if (edge.yaw == null) return;
      const yawRad = edge.yaw * (Math.PI / 180);
      const pitchRad = edge.pitch * (Math.PI / 180);
      markersRef.current.addMarker({
        id: `edge-${edge.id}`,
        html: `<div style="background:linear-gradient(135deg, #8f6826, #dfb758);color:#fff8ea;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px rgba(223,183,88,0.85);border:2.5px solid #ffffff;font-size:20px;cursor:pointer;font-weight:900;" title="Walkway to: ${edge.target_node_name || edge.target_node_id}">➜</div>`,
        position: { yaw: yawRad, pitch: pitchRad },
        anchor: 'center center',
        tooltip: `🚶‍♂️ Walk to: ${edge.target_node_name || 'Waypoint ' + edge.target_node_id}`,
        data: { type: 'edge', edge },
      });
    });

    // 2. Artifact Hotspot Markers (Curatorial Info)
    objList.forEach(obj => {
      if (obj.tour_yaw == null) return;
      const yawRad = obj.tour_yaw * (Math.PI / 180);
      const pitchRad = (obj.tour_pitch || 0) * (Math.PI / 180);
      markersRef.current.addMarker({
        id: `obj-${obj.id}`,
        html: `<div style="width:32px;height:32px;border-radius:50%;background:rgba(217,119,6,0.95);border:2.5px solid #fff;display:flex;align-items:center;justify-content:center;font-size:16px;color:#fff;font-weight:bold;box-shadow:0 0 14px rgba(217,119,6,0.85);cursor:pointer;">🏺</div>`,
        position: { yaw: yawRad, pitch: pitchRad },
        anchor: 'center center',
        tooltip: `🏺 Artifact: ${obj.name}`,
        data: { type: 'object', object: obj },
      });
    });
  }, []);

  useEffect(() => {
    renderMarkersOnPSV(edges, nodeObjects);
  }, [edges, nodeObjects, renderMarkersOnPSV]);

  // ── Quick Direction Presets ────────────────────────────────────────────────
  const applyPresetDirection = (yaw, pitch = -10, facing = 180) => {
    setNewEdge(p => ({
      ...p,
      yaw: String(yaw),
      pitch: String(pitch),
      facing_yaw: String(facing),
      target_entry_yaw: String(yaw)
    }));
    notify(`Set direction to ${yaw}°`);
  };

  // ── 1-Click Instant Quick Connect from Clicked Spot ─────────────────────────
  const handleQuickAddWalkway = async (targetNode) => {
    if (!selectedNode || !targetNode) return;
    setSaving(true);
    const yawVal = clickedPos ? clickedPos.yaw : parseFloat(newEdge.yaw || 0);
    const pitchVal = clickedPos ? clickedPos.pitch : -10;

    try {
      const r = await api.post('/admin/tour/edges', {
        museum_id: parseInt(selectedMuseumId),
        source_node_id: selectedNode.id,
        target_node_id: targetNode.id,
        yaw: yawVal,
        pitch: pitchVal,
        facing_yaw: (yawVal + 180) % 360,
        target_entry_yaw: yawVal,
        label: `${selectedNode.name} ⇆ ${targetNode.name}`,
        create_return_edge: true,
      });

      setEdges(prev => [...prev, r.data.data]);
      setShowQuickPopup(false);
      notify(`2-Way Walkway connected to ${targetNode.name}! ✓`);
      refreshNodes();
    } catch (e) {
      notify(e.response?.data?.error?.message || e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  // ── 1-Click Instant Quick Tag Artifact from Clicked Spot ────────────────────
  const handleQuickTagArtifact = async (artifact) => {
    if (!selectedNode || !artifact) return;
    setSaving(true);
    const yawVal = clickedPos ? clickedPos.yaw : 0;
    const pitchVal = clickedPos ? clickedPos.pitch : 0;

    try {
      await api.patch(`/admin/tour/objects/${artifact.id}/tour-position`, {
        tour_node_id: selectedNode.id,
        tour_yaw: parseFloat(yawVal.toFixed(1)),
        tour_pitch: parseFloat(pitchVal.toFixed(1)),
      });

      const r = await api.get(`/admin/tour/nodes/${selectedNode.id}`);
      const objs = r.data.data.objects || [];
      setNodeObjects(objs);
      setSelectedObjectId(artifact.id);
      setShowQuickPopup(false);
      setRightTab('objects');
      notify(`Tagged "${artifact.name}" at this spot! ✓`);
    } catch (e) {
      notify(e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  // ── ⚡ 1-Click Auto-Connect Whole Tour Sequence (1 ⇆ 2 ⇆ 3 ⇆ 4 ⇆ 5) ──────────
  const handleAutoConnectSequence = async () => {
    if (nodes.length < 2) {
      notify('Need at least 2 waypoints to create walkway sequence', 'err');
      return;
    }
    if (!window.confirm(`Auto-connect all ${nodes.length} waypoints sequentially (1 ⇆ 2 ⇆ 3 ...)?`)) return;

    setSaving(true);
    let createdCount = 0;

    try {
      for (let i = 0; i < nodes.length - 1; i++) {
        const fromNode = nodes[i];
        const toNode = nodes[i + 1];

        // Default ahead angle (0°) forward and return (180°)
        await api.post('/admin/tour/edges', {
          museum_id: parseInt(selectedMuseumId),
          source_node_id: fromNode.id,
          target_node_id: toNode.id,
          yaw: 0,
          pitch: -10,
          facing_yaw: 180,
          target_entry_yaw: 0,
          label: `${fromNode.name} ➜ ${toNode.name}`,
          create_return_edge: true,
        });
        createdCount++;
      }

      notify(`Connected all ${createdCount} sequence pairs (2-way)! ✓`);
      await refreshNodes();
      if (selectedNode) {
        const r = await api.get(`/admin/tour/nodes/${selectedNode.id}`);
        setEdges(r.data.data.edges || []);
      }
    } catch (e) {
      notify(e.response?.data?.error?.message || e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  // ── Edge CRUD ─────────────────────────────────────────────────────────────
  const createEdge = async () => {
    if (!newEdge.target_node_id) {
      notify('Please select a destination waypoint', 'err');
      return;
    }
    setSaving(true);
    try {
      const r = await api.post('/admin/tour/edges', {
        museum_id: parseInt(selectedMuseumId),
        source_node_id: selectedNode.id,
        target_node_id: parseInt(newEdge.target_node_id),
        yaw: parseFloat(newEdge.yaw) || 0,
        pitch: parseFloat(newEdge.pitch) || -10,
        facing_yaw: parseFloat(newEdge.facing_yaw) || 180,
        target_entry_yaw: parseFloat(newEdge.target_entry_yaw) || 0,
        label: newEdge.label || null,
        create_return_edge: newEdge.create_return_edge,
      });
      setEdges(prev => [...prev, r.data.data]);
      setNewEdge({
        target_node_id: '',
        yaw: '0',
        pitch: '-10',
        facing_yaw: '180',
        target_entry_yaw: '0',
        label: '',
        create_return_edge: true,
      });
      notify(newEdge.create_return_edge ? '2-Way Walkway Arrows created ✓' : 'Walkway Arrow added ✓');
      refreshNodes();
    } catch (e) {
      notify(e.response?.data?.error?.message || e.message, 'err');
    }
    setSaving(false);
  };

  const deleteEdge = async (edgeId) => {
    if (!window.confirm('Delete this walkway arrow connection?')) return;
    try {
      await api.delete(`/admin/tour/edges/${edgeId}`);
      setEdges(prev => prev.filter(e => e.id !== edgeId));
      notify('Arrow removed');
      refreshNodes();
    } catch (e) {
      notify(e.message, 'err');
    }
  };

  // ── Node CRUD ─────────────────────────────────────────────────────────────
  const saveNode = async () => {
    if (!selectedNode) return;
    setSaving(true);
    try {
      await api.patch(`/admin/tour/nodes/${selectedNode.id}`, {
        name: nodeForm.name,
        description: nodeForm.description || null,
        gallery_id: nodeForm.gallery_id || null,
        compass_bearing_ref: nodeForm.compass_bearing_ref !== '' ? parseFloat(nodeForm.compass_bearing_ref) : null,
        pos_x: nodeForm.pos_x !== '' ? parseFloat(nodeForm.pos_x) : null,
        pos_y: nodeForm.pos_y !== '' ? parseFloat(nodeForm.pos_y) : null,
        is_start: nodeForm.is_start,
      });
      notify('Waypoint saved ✓');
      refreshNodes();
    } catch (e) {
      notify(e.response?.data?.error?.message || e.message, 'err');
    }
    setSaving(false);
  };

  const openCreateNodeModal = () => {
    setNewNodeName(`Waypoint ${nodes.length + 1}`);
    setShowNewNodeModal(true);
  };

  const handleConfirmCreateNode = async (e) => {
    if (e) e.preventDefault();
    if (!selectedMuseumId || !newNodeName.trim()) return;
    setSaving(true);
    try {
      const r = await api.post('/admin/tour/nodes', {
        museum_id: parseInt(selectedMuseumId),
        name: newNodeName.trim(),
        is_start: nodes.length === 0,
      });
      setShowNewNodeModal(false);
      setNewNodeName('');
      await refreshNodes();
      setSelectedNode(r.data.data);
      notify('New Waypoint created ✓');
    } catch (e) {
      notify(e.response?.data?.error?.message || e.message, 'err');
    }
    setSaving(false);
  };

  const deleteNode = async (nodeId) => {
    if (!window.confirm('Delete this tour waypoint? All connected arrows will also be removed.')) return;
    try {
      await api.delete(`/admin/tour/nodes/${nodeId}`);
      setSelectedNode(null);
      refreshNodes();
      notify('Waypoint deleted');
    } catch (e) {
      notify(e.message, 'err');
    }
  };

  const refreshNodes = async () => {
    const r = await api.get(`/admin/tour/nodes?museum_id=${selectedMuseumId}`);
    setNodes(r.data.data || []);
  };

  // ── Upload Panorama ───────────────────────────────────────────────────────
  const uploadPanorama = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedNode) return;
    setUploadingPano(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await api.post(`/admin/upload/panorama/${selectedNode.id}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notify(`360° Photo uploaded successfully! ✓`);
      setSelectedNode(prev => ({ ...prev, panorama_url: r.data.data.url, tile_status: r.data.data.tile_status }));
    } catch (e) {
      notify(e.response?.data?.error?.message || e.message, 'err');
    }
    setUploadingPano(false);
  };

  // ── Object Form CRUD ───────────────────────────────────────────────────────
  const saveObjectForm = async () => {
    if (!selectedObjectId) return;
    setSaving(true);
    try {
      await api.patch(`/admin/tour/objects/${selectedObjectId}/tour-position`, {
        tour_node_id: selectedNode?.id || null,
        tour_yaw: objectForm.tour_yaw !== '' ? parseFloat(objectForm.tour_yaw) : null,
        tour_pitch: objectForm.tour_pitch !== '' ? parseFloat(objectForm.tour_pitch) : null,
        category: objectForm.category || null,
        period: objectForm.period || null,
        origin: objectForm.origin || null,
        provenance: objectForm.provenance || null,
        materials: objectForm.materials || null,
        dimensions: objectForm.dimensions || null,
        description: objectForm.description || null,
      });
      notify('Artifact data & hotspot position saved ✓');
      const r = await api.get(`/admin/tour/nodes/${selectedNode.id}`);
      setNodeObjects(r.data.data.objects || []);
    } catch (e) {
      notify(e.response?.data?.error?.message || e.message, 'err');
    }
    setSaving(false);
  };

  const assignObjectToNode = async () => {
    if (!addObjectId || !selectedNode) return;
    try {
      await api.patch(`/admin/tour/objects/${addObjectId}/tour-position`, {
        tour_node_id: selectedNode.id,
        tour_yaw: clickedPos ? parseFloat(clickedPos.yaw.toFixed(1)) : 0,
        tour_pitch: clickedPos ? parseFloat(clickedPos.pitch.toFixed(1)) : 0,
      });
      setAddObjectId('');
      const r = await api.get(`/admin/tour/nodes/${selectedNode.id}`);
      const objs = r.data.data.objects || [];
      setNodeObjects(objs);
      setSelectedObjectId(parseInt(addObjectId));
      notify('Artifact assigned to this waypoint ✓');
    } catch (e) {
      notify(e.message, 'err');
    }
  };

  const unassignObjectFromNode = async (objectId) => {
    if (!window.confirm('Remove this artifact hotspot from this waypoint?')) return;
    try {
      await api.patch(`/admin/tour/objects/${objectId}/tour-position`, {
        tour_node_id: null,
      });
      const r = await api.get(`/admin/tour/nodes/${selectedNode.id}`);
      const objs = r.data.data.objects || [];
      setNodeObjects(objs);
      setSelectedObjectId(objs.length > 0 ? objs[0].id : null);
      notify('Artifact removed from this waypoint ✓');
    } catch (e) {
      notify(e.message, 'err');
    }
  };

  const filteredNodes = nodes.filter(n => !searchQuery || n.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const currentNodeIndex = nodes.findIndex(n => n.id === selectedNode?.id);
  const otherNodes = nodes.filter(n => n.id !== selectedNode?.id);
  const unassignedObjects = allMuseumObjects.filter(o => !nodeObjects.find(no => no.id === o.id));

  return (
    <div style={S.page}>
      <style>{`
        .admin-studio-input {
          background: #18182c;
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: #f9fafb;
          border-radius: 8px;
          padding: 8px 12px;
          width: 100%;
          font-size: 0.85rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .admin-studio-input:focus {
          border-color: #dfb758;
          box-shadow: 0 0 0 2px rgba(223, 183, 88, 0.3);
        }
        .admin-studio-btn {
          background: linear-gradient(135deg, #8f6826, #dfb758);
          border: none;
          color: #fff8ea;
          border-radius: 8px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: transform 0.15s, opacity 0.15s;
          box-shadow: 0 2px 8px rgba(143, 104, 38, 0.4);
        }
        .admin-studio-btn:hover {
          opacity: 0.95;
          transform: translateY(-1px);
        }
        .admin-studio-btn.secondary {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #e5e7eb;
          box-shadow: none;
        }
        .admin-studio-btn.secondary:hover {
          background: rgba(255, 255, 255, 0.16);
        }
        .admin-studio-btn.danger {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #fca5a5;
          box-shadow: none;
        }
        .admin-studio-btn.sm {
          padding: 5px 10px;
          font-size: 0.75rem;
        }
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(223, 183, 88, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(223, 183, 88, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(223, 183, 88, 0); }
        }
      `}</style>

      {/* ── Toast Notifications ───────────────────────────────────────── */}
      {msg && (
        <div style={{
          ...S.toast,
          background: msg.type === 'err' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)'
        }}>
          {msg.type === 'err' ? '⚠️ ' : '✅ '} {msg.text}
        </div>
      )}

      {/* ── Top App Bar ──────────────────────────────────────────────── */}
      <header style={S.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={S.logoIcon}>🏛️</div>
          <div>
            <h1 style={S.h1}>Virtual Tour Studio</h1>
            <p style={S.subtitle}>Google Street View style 360° navigation & artifact hotspot creator</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Museum Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#9ca3af', fontSize: '0.8rem', fontWeight: 600 }}>Museum:</span>
            <select
              value={selectedMuseumId}
              onChange={e => {
                setSelectedMuseumId(e.target.value);
                setSelectedNode(null);
              }}
              style={S.select}
            >
              {museums.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <button
            className="admin-studio-btn secondary sm"
            onClick={() => setShowGuide(g => !g)}
            title="Toggle quick visual guide"
          >
            {showGuide ? 'Hide Guide' : '❓ How It Works'}
          </button>
        </div>
      </header>

      {/* ── Step-by-Step Visual Guide Banner ──────────────────────────── */}
      {showGuide && (
        <div style={S.guideBanner}>
          <div style={S.guideStep}>
            <div style={S.stepBadge}>1</div>
            <div>
              <strong style={{ color: '#fff' }}>Click Anywhere on 360° Photo</strong>
              <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Look around the room and click on a doorway or artifact</div>
            </div>
          </div>
          <div style={{ color: '#dfb758', fontSize: '1.2rem' }}>➜</div>
          <div style={S.guideStep}>
            <div style={S.stepBadge}>2</div>
            <div>
              <strong style={{ color: '#fff' }}>1-Click Popover Appears</strong>
              <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Tap the destination room button to instantly connect arrows</div>
            </div>
          </div>
          <div style={{ color: '#dfb758', fontSize: '1.2rem' }}>➜</div>
          <div style={S.guideStep}>
            <div style={S.stepBadge}>3</div>
            <div>
              <strong style={{ color: '#fff' }}>Instant 2-Way Walkway</strong>
              <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Forward and return paths are automatically connected!</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main 3-Column Studio Workspace ───────────────────────────── */}
      <div style={S.main}>

        {/* ── LEFT: Corridor Waypoint Sequence ───────────────────────── */}
        <aside style={S.left}>
          <div style={S.panelHeader}>
            <div>
              <span style={S.panelTitle}>Walkway Sequence</span>
              <span style={S.countBadge}>{nodes.length} points</span>
            </div>
            {selectedMuseumId && (
              <button className="admin-studio-btn sm" onClick={openCreateNodeModal}>+ New Point</button>
            )}
          </div>

          {/* ⚡ 1-Click Auto-Connect Whole Sequence */}
          {nodes.length >= 2 && (
            <div style={{ padding: '8px 12px', background: 'rgba(223, 183, 88, 0.08)', borderBottom: '1px solid rgba(223, 183, 88, 0.2)' }}>
              <button
                className="admin-studio-btn sm"
                onClick={handleAutoConnectSequence}
                disabled={saving}
                style={{ width: '100%', fontSize: '0.78rem', background: 'linear-gradient(135deg, #8f6826, #dfb758)' }}
                title="Automatically create 2-way walking paths between all waypoints in order"
              >
                ⚡ 1-Click Auto-Link All ({nodes.length} points)
              </button>
            </div>
          )}

          <div style={{ padding: '8px 12px' }}>
            <input
              className="admin-studio-input"
              placeholder="🔍 Search rooms & corridors..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '6px 10px' }}
            />
          </div>

          <div style={S.nodeList}>
            {nodes.length === 0 && (
              <div style={S.empty}>
                <p>No waypoints found for this museum.</p>
                <button className="admin-studio-btn sm" onClick={openCreateNodeModal} style={{ marginTop: 8 }}>
                  + Add First Waypoint
                </button>
              </div>
            )}

            {filteredNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const globalIdx = nodes.findIndex(n => n.id === node.id);
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  style={{
                    ...S.nodeCard,
                    background: isSelected ? 'rgba(223, 183, 88, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                    borderColor: isSelected ? '#dfb758' : 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{
                      ...S.stepNumber,
                      background: isSelected ? '#8f6826' : 'rgba(255,255,255,0.1)',
                      color: '#fff'
                    }}>
                      {globalIdx + 1}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: isSelected ? '#ffe29a' : '#e5e7eb',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {node.name}
                        </span>
                        {node.is_start && (
                          <span style={S.startPill} title="Tour Starting Point">START</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 2, fontSize: '0.7rem', color: '#9ca3af' }}>
                        <span>🔗 {node.outgoing_edge_count ?? 0} arrows</span>
                      </div>
                    </div>
                  </div>

                  <button
                    className="admin-studio-btn sm danger"
                    onClick={e => {
                      e.stopPropagation();
                      deleteNode(node.id);
                    }}
                    title="Delete waypoint"
                    style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── CENTER: 360° Interactive Studio Canvas ─────────────────── */}
        <main style={S.center}>
          {/* Top Corridor Walk Navigation Bar */}
          {selectedNode && nodes.length > 1 && (
            <div style={S.centerTopBar}>
              <button
                className="admin-studio-btn secondary sm"
                onClick={() => {
                  const prevIdx = (currentNodeIndex - 1 + nodes.length) % nodes.length;
                  setSelectedNode(nodes[prevIdx]);
                }}
              >
                ← Previous Step
              </button>

              <div style={{ textAlign: 'center' }}>
                <span style={{ color: '#e5e7eb', fontWeight: 700, fontSize: '0.9rem' }}>
                  {selectedNode.name}
                </span>
                <span style={{ color: '#dfb758', marginLeft: 8, fontSize: '0.75rem', fontWeight: 800 }}>
                  ({currentNodeIndex + 1} of {nodes.length})
                </span>
              </div>

              <button
                className="admin-studio-btn secondary sm"
                onClick={() => {
                  const nextIdx = (currentNodeIndex + 1) % nodes.length;
                  setSelectedNode(nodes[nextIdx]);
                }}
              >
                Next Step →
              </button>
            </div>
          )}

          {/* Empty / Upload Prompt State */}
          {!selectedNode && (
            <div style={S.psvEmpty}>
              <span style={{ fontSize: '3rem' }}>🏛️</span>
              <h3 style={{ color: '#e5e7eb', margin: '12px 0 4px' }}>No Waypoint Selected</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>Select a waypoint from the left corridor sequence to view its 360° panorama.</p>
            </div>
          )}

          {selectedNode && !selectedNode.panorama_url && (
            <div style={S.psvEmpty}>
              <span style={{ fontSize: '3rem' }}>📸</span>
              <h3 style={{ color: '#e5e7eb', margin: '12px 0 4px' }}>360° Photo Needed</h3>
              <p style={{ color: '#9ca3af', fontSize: '0.85rem', maxWidth: 360, margin: '0 auto 16px' }}>
                Upload an equirectangular 360° photo for <strong>{selectedNode.name}</strong> to start placing walkway arrows and artifacts.
              </p>
              <label style={{ ...S.uploadLabel, cursor: 'pointer' }}>
                {uploadingPano ? 'Uploading Photo…' : '📁 Upload 360° Photo'}
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPanorama} disabled={uploadingPano} />
              </label>
            </div>
          )}

          {/* PSV Container */}
          <div
            ref={psvContainerRef}
            id="admin-psv-container"
            style={{ width: '100%', height: '100%', display: selectedNode?.panorama_url ? 'block' : 'none' }}
          />

          {/* ── 🎯 INSTANT ON-CANVAS PLACEMENT POPOVER ──────────────────── */}
          {selectedNode?.panorama_url && showQuickPopup && clickedPos && (
            <div style={S.quickPopupCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '1rem' }}>🎯</span>
                  <strong style={{ color: '#ffe29a', fontSize: '0.85rem' }}>
                    Targeted Spot ({fmt(clickedPos.yaw)}°, {fmt(clickedPos.pitch)}°)
                  </strong>
                </div>
                <button
                  onClick={() => setShowQuickPopup(false)}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1rem' }}
                >
                  ✕
                </button>
              </div>

              {/* Mode Toggle inside Popover */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button
                  onClick={() => setQuickPopupTab('walkway')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: quickPopupTab === 'walkway' ? 'linear-gradient(135deg, #8f6826, #dfb758)' : 'rgba(255,255,255,0.06)',
                    borderColor: quickPopupTab === 'walkway' ? '#dfb758' : 'rgba(255,255,255,0.12)',
                    color: '#fff8ea',
                  }}
                >
                  🚶‍♂️ Connect Walkway
                </button>
                <button
                  onClick={() => setQuickPopupTab('artifact')}
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: quickPopupTab === 'artifact' ? 'rgba(217,119,6,0.9)' : 'rgba(255,255,255,0.06)',
                    borderColor: quickPopupTab === 'artifact' ? '#f59e0b' : 'rgba(255,255,255,0.12)',
                    color: '#fff8ea',
                  }}
                >
                  🏺 Tag Artifact
                </button>
              </div>

              {/* Popover Content 1: Walkway List */}
              {quickPopupTab === 'walkway' && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#d4c4ac', display: 'block', marginBottom: 6 }}>
                    Select where this doorway / arrow leads:
                  </span>
                  {otherNodes.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: '0.75rem' }}>No other waypoints created yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                      {otherNodes.map(n => (
                        <button
                          key={n.id}
                          onClick={() => handleQuickAddWalkway(n)}
                          disabled={saving}
                          style={S.quickPillBtn}
                        >
                          <span>➜</span>
                          <span>{n.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Popover Content 2: Artifact List */}
              {quickPopupTab === 'artifact' && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#d4c4ac', display: 'block', marginBottom: 6 }}>
                    Select artifact to place at this spot:
                  </span>
                  {unassignedObjects.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: '0.75rem' }}>All museum artifacts are already tagged or none available.</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                      {unassignedObjects.map(o => (
                        <button
                          key={o.id}
                          onClick={() => handleQuickTagArtifact(o)}
                          disabled={saving}
                          style={{ ...S.quickPillBtn, borderColor: 'rgba(217,119,6,0.5)', background: 'rgba(217,119,6,0.15)' }}
                        >
                          <span>🏺</span>
                          <span style={{ maxWidth: 180, truncate: 'true', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Interactive Floating Bottom Status Bar */}
          {selectedNode?.panorama_url && (
            <div style={S.bottomActionBar}>
              {clickedPos ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '0.8rem', color: '#e5e7eb' }}>
                    🎯 <strong>Target Set:</strong> Yaw {fmt(clickedPos.yaw)}° · Pitch {fmt(clickedPos.pitch)}°
                  </span>
                  <button
                    className="admin-studio-btn sm"
                    onClick={() => setShowQuickPopup(true)}
                    style={{ padding: '3px 10px', fontSize: '0.75rem', background: 'linear-gradient(135deg, #8f6826, #dfb758)' }}
                  >
                    + Place Marker Here
                  </button>
                  <button
                    className="admin-studio-btn danger sm"
                    onClick={() => { setClickedPos(null); setShowQuickPopup(false); }}
                    style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                  >
                    ✕ Clear
                  </button>
                </div>
              ) : (
                <div style={{ color: '#d4c4ac', fontSize: '0.78rem' }}>
                  💡 <strong>How to Add:</strong> Click any doorway or artifact in the 360° photo to instantly pop up the 1-click connector.
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── RIGHT: Mode Action Panels ──────────────────────────────── */}
        <aside style={S.right}>
          {!selectedNode ? (
            <div style={{ padding: 32, color: '#6b7280', textAlign: 'center' }}>
              Select a waypoint on the left to edit its connections and artifacts.
            </div>
          ) : (
            <>
              {/* Action Tabs */}
              <div style={S.tabs}>
                <button
                  onClick={() => setRightTab('edges')}
                  style={{ ...S.tab, ...(rightTab === 'edges' ? S.tabActive : {}) }}
                >
                  🚶‍♂️ Walkways ({edges.length})
                </button>
                <button
                  onClick={() => setRightTab('objects')}
                  style={{ ...S.tab, ...(rightTab === 'objects' ? S.tabActive : {}) }}
                >
                  🏺 Artifacts ({nodeObjects.length})
                </button>
                <button
                  onClick={() => setRightTab('node')}
                  style={{ ...S.tab, ...(rightTab === 'node' ? S.tabActive : {}) }}
                >
                  ⚙️ Settings
                </button>
              </div>

              <div style={S.panelBody}>

                {/* ═══════════════════════════════════════════════════════ */}
                {/* TAB 1: WALKWAY ARROWS (NAVIGATION)                      */}
                {/* ═══════════════════════════════════════════════════════ */}
                {rightTab === 'edges' && (
                  <div>
                    <div style={S.tabHeader}>
                      <h3 style={S.tabHeading}>Walkway Navigation Arrows</h3>
                      <p style={S.tabDesc}>
                        Define where visitors can walk from this 360° spot. Intermediate corridor points usually have 2 arrows (Forward & Back).
                      </p>
                    </div>

                    {/* Quick Suggestions for other waypoints */}
                    {otherNodes.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <span style={S.subheading}>⚡ 1-Click Quick Connect</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {otherNodes.map(n => {
                            const isAlreadyConnected = edges.some(e => e.target_node_id === n.id);
                            return (
                              <button
                                key={n.id}
                                onClick={() => handleQuickAddWalkway(n)}
                                disabled={saving}
                                style={{
                                  ...S.quickPillBtn,
                                  opacity: isAlreadyConnected ? 0.6 : 1,
                                  background: isAlreadyConnected ? 'rgba(255,255,255,0.04)' : 'rgba(223, 183, 88, 0.15)',
                                  borderColor: isAlreadyConnected ? 'rgba(255,255,255,0.1)' : '#dfb758'
                                }}
                                title={isAlreadyConnected ? 'Already connected (click to add another)' : 'Connect 2-way arrow now'}
                              >
                                <span>{isAlreadyConnected ? '✓' : '➕'}</span>
                                <span>Link to {n.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Existing Connected Arrows */}
                    <div style={{ marginBottom: 16 }}>
                      <span style={S.subheading}>Connected Paths from Here ({edges.length})</span>
                      {edges.length === 0 ? (
                        <p style={S.emptyBox}>No walkway arrows connected yet. Click on the 360° photo to add one!</p>
                      ) : (
                        edges.map(edge => (
                          <div key={edge.id} style={S.edgeCard}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '1.1rem', color: '#dfb758' }}>➜</span>
                              <div>
                                <strong style={{ color: '#fff', fontSize: '0.85rem' }}>
                                  {edge.target_node_name || `Waypoint ${edge.target_node_id}`}
                                </strong>
                                <div style={{ color: '#9ca3af', fontSize: '0.72rem' }}>
                                  Direction: {fmt(edge.yaw)}° · {edge.label || 'Standard walkway'}
                                </div>
                              </div>
                            </div>
                            <button
                              className="admin-studio-btn sm danger"
                              onClick={() => deleteEdge(edge.id)}
                              title="Remove connection"
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Walkway Arrow Form */}
                    <div style={S.addBox}>
                      <span style={{ ...S.subheading, color: '#ffe29a' }}>+ Custom Arrow Placement</span>

                      <Field label="Destination Waypoint *">
                        <select
                          className="admin-studio-input"
                          value={newEdge.target_node_id}
                          onChange={e => setNewEdge(p => ({ ...p, target_node_id: e.target.value }))}
                        >
                          <option value="">— Choose where this arrow leads —</option>
                          {otherNodes.map(n => (
                            <option key={n.id} value={n.id}>{n.name}</option>
                          ))}
                        </select>
                      </Field>

                      {/* Direction Presets */}
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={S.fieldLabel}>Arrow Direction</span>
                          <span style={{ fontSize: '0.75rem', color: '#dfb758', fontWeight: 700 }}>
                            Aim: {fmt(newEdge.yaw)}°
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                          <button
                            type="button"
                            className="admin-studio-btn secondary sm"
                            onClick={() => applyPresetDirection(0, -10, 180)}
                            title="Ahead (0°)"
                          >
                            ⬆️ Ahead
                          </button>
                          <button
                            type="button"
                            className="admin-studio-btn secondary sm"
                            onClick={() => applyPresetDirection(180, -10, 0)}
                            title="Back (180°)"
                          >
                            ⬇️ Return
                          </button>
                          <button
                            type="button"
                            className="admin-studio-btn secondary sm"
                            onClick={() => applyPresetDirection(-90, -10, 90)}
                            title="Left (-90°)"
                          >
                            ⬅️ Left
                          </button>
                          <button
                            type="button"
                            className="admin-studio-btn secondary sm"
                            onClick={() => applyPresetDirection(90, -10, -90)}
                            title="Right (90°)"
                          >
                            ➡️ Right
                          </button>
                        </div>
                      </div>

                      {/* Advanced Angles Toggle */}
                      <button
                        type="button"
                        onClick={() => setShowAdvancedAngles(s => !s)}
                        style={S.toggleLink}
                      >
                        {showAdvancedAngles ? '▲ Hide Advanced Angles' : '▼ Fine-Tune Exact Angles'}
                      </button>

                      {showAdvancedAngles && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                          <Field label="Compass Angle (Yaw °)">
                            <input
                              className="admin-studio-input"
                              type="number"
                              step="0.1"
                              value={newEdge.yaw}
                              onChange={e => setNewEdge(p => ({ ...p, yaw: e.target.value }))}
                            />
                          </Field>
                          <Field label="Floor Tilt (Pitch °)">
                            <input
                              className="admin-studio-input"
                              type="number"
                              step="0.1"
                              value={newEdge.pitch}
                              onChange={e => setNewEdge(p => ({ ...p, pitch: e.target.value }))}
                            />
                          </Field>
                          <Field label="Arrival Facing (Yaw °)">
                            <input
                              className="admin-studio-input"
                              type="number"
                              step="0.1"
                              value={newEdge.target_entry_yaw}
                              onChange={e => setNewEdge(p => ({ ...p, target_entry_yaw: e.target.value }))}
                            />
                          </Field>
                          <Field label="Corridor Label">
                            <input
                              className="admin-studio-input"
                              value={newEdge.label}
                              onChange={e => setNewEdge(p => ({ ...p, label: e.target.value }))}
                              placeholder="e.g. Gallery Room"
                            />
                          </Field>
                        </div>
                      )}

                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '8px 10px', background: 'rgba(223, 183, 88, 0.08)', borderRadius: 8, border: '1px solid rgba(223, 183, 88, 0.25)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={newEdge.create_return_edge}
                          onChange={e => setNewEdge(p => ({ ...p, create_return_edge: e.target.checked }))}
                          style={{ accentColor: '#dfb758', width: 16, height: 16 }}
                        />
                        <div>
                          <strong style={{ color: '#e5e7eb', fontSize: '0.78rem' }}>Create 2-Way Connection</strong>
                          <div style={{ color: '#9ca3af', fontSize: '0.7rem' }}>Automatically adds return arrow from destination back to this spot</div>
                        </div>
                      </label>

                      <button
                        className="admin-studio-btn"
                        onClick={createEdge}
                        disabled={saving}
                        style={{ marginTop: 12, width: '100%' }}
                      >
                        {saving ? 'Creating Arrow…' : '+ Place Walkway Arrow'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════ */}
                {/* TAB 2: ARTIFACT HOTSPOTS (CURATORIAL INFO)              */}
                {/* ═══════════════════════════════════════════════════════ */}
                {rightTab === 'objects' && (
                  <div>
                    <div style={S.tabHeader}>
                      <h3 style={S.tabHeading}>Artifact Info Hotspots</h3>
                      <p style={S.tabDesc}>
                        Tag real artifacts visible in this 360° photo. Clicking an artifact opens its information card in-place without moving the visitor.
                      </p>
                    </div>

                    {/* Assign an existing artifact */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <select
                        className="admin-studio-input"
                        value={addObjectId}
                        onChange={e => setAddObjectId(e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="">— Tag an artifact in this photo —</option>
                        {unassignedObjects.map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                      <button className="admin-studio-btn sm" onClick={assignObjectToNode}>
                        + Add
                      </button>
                    </div>

                    {/* Artifact selector pills */}
                    {nodeObjects.length === 0 ? (
                      <p style={S.emptyBox}>No artifacts tagged in this 360° photo yet. Click the photo to place one!</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                        {nodeObjects.map(o => (
                          <button
                            key={o.id}
                            onClick={() => setSelectedObjectId(o.id)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 20,
                              border: '1px solid',
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              background: selectedObjectId === o.id ? 'rgba(217,119,6,0.25)' : 'rgba(255,255,255,0.05)',
                              borderColor: selectedObjectId === o.id ? '#f59e0b' : 'rgba(255,255,255,0.12)',
                              color: selectedObjectId === o.id ? '#fef08a' : '#d1d5db',
                              fontWeight: selectedObjectId === o.id ? 700 : 500,
                            }}
                          >
                            <span>🏺</span>
                            <span>{o.name}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Object Curatorial Form */}
                    {selectedObjectId && (
                      <div style={S.curatorialForm}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={S.subheading}>Artifact Card Details</span>
                          {clickedPos && (
                            <button
                              type="button"
                              className="admin-studio-btn sm"
                              onClick={() => {
                                setObjectForm(p => ({
                                  ...p,
                                  tour_yaw: clickedPos.yaw.toFixed(1),
                                  tour_pitch: clickedPos.pitch.toFixed(1)
                                }));
                                notify('Hotspot set to clicked spot ✓');
                              }}
                              style={{ background: 'rgba(217,119,6,0.25)', color: '#fef08a', borderColor: '#f59e0b' }}
                            >
                              🎯 Use Clicked Spot ({fmt(clickedPos.yaw)}°)
                            </button>
                          )}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                          <Field label="Marker Yaw (Horizontal °)">
                            <input
                              className="admin-studio-input"
                              type="number"
                              step="0.1"
                              value={objectForm.tour_yaw ?? ''}
                              onChange={e => setObjectForm(p => ({ ...p, tour_yaw: e.target.value }))}
                            />
                          </Field>
                          <Field label="Marker Pitch (Tilt °)">
                            <input
                              className="admin-studio-input"
                              type="number"
                              step="0.1"
                              value={objectForm.tour_pitch ?? ''}
                              onChange={e => setObjectForm(p => ({ ...p, tour_pitch: e.target.value }))}
                            />
                          </Field>
                        </div>

                        <Field label="Category">
                          <input
                            className="admin-studio-input"
                            value={objectForm.category || ''}
                            onChange={e => setObjectForm(p => ({ ...p, category: e.target.value }))}
                            placeholder="e.g. Ancient Sculpture"
                          />
                        </Field>

                        <Field label="Historical Period / Era">
                          <input
                            className="admin-studio-input"
                            value={objectForm.period || ''}
                            onChange={e => setObjectForm(p => ({ ...p, period: e.target.value }))}
                            placeholder="e.g. Neo-Assyrian Empire (c. 721 BCE)"
                          />
                        </Field>

                        <Field label="Materials & Dimensions">
                          <input
                            className="admin-studio-input"
                            value={objectForm.materials || ''}
                            onChange={e => setObjectForm(p => ({ ...p, materials: e.target.value }))}
                            placeholder="e.g. Alabaster (gypsum), 490 × 318 cm"
                          />
                        </Field>

                        <Field label="Curatorial Description">
                          <textarea
                            className="admin-studio-input"
                            rows={3}
                            value={objectForm.description || ''}
                            onChange={e => setObjectForm(p => ({ ...p, description: e.target.value }))}
                            placeholder="Historical background and significance shown when visitors tap this artifact."
                            style={{ resize: 'vertical' }}
                          />
                        </Field>

                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                          <button
                            className="admin-studio-btn sm danger"
                            type="button"
                            onClick={() => unassignObjectFromNode(selectedObjectId)}
                            title="Unlink this artifact from this waypoint"
                            style={{ padding: '8px 12px' }}
                          >
                            ✕ Unlink Hotspot
                          </button>
                          <button
                            className="admin-studio-btn"
                            type="button"
                            onClick={saveObjectForm}
                            disabled={saving}
                            style={{ flex: 1 }}
                          >
                            {saving ? 'Saving…' : '💾 Save Artifact Hotspot'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ═══════════════════════════════════════════════════════ */}
                {/* TAB 3: WAYPOINT SETTINGS                                */}
                {/* ═══════════════════════════════════════════════════════ */}
                {rightTab === 'node' && (
                  <div>
                    <div style={S.tabHeader}>
                      <h3 style={S.tabHeading}>Waypoint Settings</h3>
                      <p style={S.tabDesc}>Configure waypoint name, start location status, and 360° photo source.</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <Field label="Waypoint / Room Name *">
                        <input
                          className="admin-studio-input"
                          value={nodeForm.name}
                          onChange={e => setNodeForm(p => ({ ...p, name: e.target.value }))}
                        />
                      </Field>

                      <Field label="Description (Optional)">
                        <textarea
                          className="admin-studio-input"
                          rows={2}
                          value={nodeForm.description}
                          onChange={e => setNodeForm(p => ({ ...p, description: e.target.value }))}
                          style={{ resize: 'vertical' }}
                        />
                      </Field>

                      <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={nodeForm.is_start}
                            onChange={e => setNodeForm(p => ({ ...p, is_start: e.target.checked }))}
                            style={{ width: 18, height: 18, accentColor: '#10b981' }}
                          />
                          <div>
                            <strong style={{ color: '#e5e7eb', fontSize: '0.82rem' }}>Tour Starting Point</strong>
                            <div style={{ color: '#9ca3af', fontSize: '0.72rem' }}>Visitors start at this 360° photo when opening the virtual tour.</div>
                          </div>
                        </label>
                      </div>

                      <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
                        <span style={S.fieldLabel}>360° Photo Panorama</span>
                        {selectedNode.panorama_url ? (
                          <div style={{ marginTop: 6 }}>
                            <div style={{ fontSize: '0.75rem', color: '#10b981', marginBottom: 8 }}>
                              ✓ 360° Photo active ({selectedNode.tile_status || 'Ready'})
                            </div>
                            <label style={{ ...S.uploadLabel, cursor: 'pointer' }}>
                              {uploadingPano ? 'Replacing Photo…' : '🔄 Replace 360° Photo'}
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPanorama} disabled={uploadingPano} />
                            </label>
                          </div>
                        ) : (
                          <div style={{ marginTop: 6 }}>
                            <label style={{ ...S.uploadLabel, cursor: 'pointer' }}>
                              {uploadingPano ? 'Uploading…' : '📁 Upload 360° Photo'}
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadPanorama} disabled={uploadingPano} />
                            </label>
                          </div>
                        )}
                      </div>

                      <button
                        className="admin-studio-btn"
                        onClick={saveNode}
                        disabled={saving}
                        style={{ marginTop: 6 }}
                      >
                        {saving ? 'Saving…' : '💾 Save Waypoint Settings'}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </>
          )}
        </aside>

      </div>

      {/* ── Modal: Create New Node ────────────────────────────────────── */}
      {showNewNodeModal && (
        <div style={S.modalBackdrop}>
          <div style={S.modal}>
            <h3 style={{ color: '#f3f4f6', margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 700 }}>
              + Add New Tour Waypoint
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '0.8rem', margin: '0 0 16px' }}>
              Create a new 360° photo spot along your museum walkthrough sequence.
            </p>
            <form onSubmit={handleConfirmCreateNode}>
              <Field label="Waypoint Name *">
                <input
                  className="admin-studio-input"
                  autoFocus
                  value={newNodeName}
                  onChange={e => setNewNodeName(e.target.value)}
                  placeholder="e.g. Gallery 3 — Persian Wing"
                  required
                />
              </Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
                <button
                  type="button"
                  className="admin-studio-btn secondary"
                  onClick={() => setShowNewNodeModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-studio-btn"
                  disabled={saving || !newNodeName.trim()}
                >
                  {saving ? 'Creating…' : 'Create Waypoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper Field Component
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 10 }}>
    <label style={{ display: 'block', color: '#9ca3af', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
      {label}
    </label>
    {children}
  </div>
);

// Styles
const S = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 80px)',
    background: '#0d0d17',
    color: '#e5e7eb',
    overflow: 'hidden',
  },
  header: {
    height: 56,
    padding: '0 20px',
    background: '#121222',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  logoIcon: {
    fontSize: '1.4rem',
  },
  h1: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.72rem',
    color: '#9ca3af',
    margin: 0,
  },
  select: {
    background: '#18182c',
    color: '#f9fafb',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: 8,
    padding: '5px 10px',
    fontSize: '0.8rem',
    outline: 'none',
    cursor: 'pointer',
  },
  guideBanner: {
    background: 'linear-gradient(90deg, #18182c, #1f1f3a)',
    borderBottom: '1px solid rgba(223, 183, 88, 0.3)',
    padding: '10px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    flexShrink: 0,
  },
  guideStep: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #8f6826, #dfb758)',
    color: '#fff8ea',
    fontWeight: 800,
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '270px 1fr 350px',
    overflow: 'hidden',
  },
  left: {
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'rgba(15, 15, 26, 0.95)',
  },
  panelHeader: {
    padding: '12px 14px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  panelTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#f3f4f6',
  },
  countBadge: {
    marginLeft: 8,
    fontSize: '0.7rem',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#9ca3af',
    padding: '2px 6px',
    borderRadius: 12,
  },
  nodeList: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px 10px',
  },
  nodeCard: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid',
    marginBottom: 6,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: 'all 0.15s ease',
  },
  stepNumber: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    fontSize: '0.7rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  startPill: {
    fontSize: '0.62rem',
    fontWeight: 800,
    background: 'rgba(16, 185, 129, 0.2)',
    color: '#34d399',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    borderRadius: 4,
    padding: '1px 4px',
  },
  center: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    background: '#090912',
    overflow: 'hidden',
  },
  centerTopBar: {
    position: 'absolute',
    top: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 20,
    background: 'rgba(18, 18, 34, 0.9)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    padding: '4px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.6)',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 20,
    background: 'rgba(18, 18, 34, 0.92)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(223, 183, 88, 0.4)',
    borderRadius: 30,
    padding: '6px 18px',
    display: 'flex',
    alignItems: 'center',
    boxShadow: '0 6px 25px rgba(0, 0, 0, 0.6)',
  },
  quickPopupCard: {
    position: 'absolute',
    top: 70,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 30,
    background: 'rgba(20, 20, 36, 0.96)',
    backdropFilter: 'blur(16px)',
    border: '2px solid #dfb758',
    borderRadius: 16,
    padding: '14px 18px',
    width: '90%',
    maxWidth: 420,
    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(223, 183, 88, 0.3)',
    animation: 'fadeIn 0.2s ease',
  },
  quickPillBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 20,
    border: '1px solid rgba(223, 183, 88, 0.4)',
    background: 'rgba(223, 183, 88, 0.12)',
    color: '#fff8ea',
    fontSize: '0.78rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  psvEmpty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#9ca3af',
    padding: 32,
    textAlign: 'center',
  },
  right: {
    borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'rgba(15, 15, 26, 0.95)',
    height: '100%',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    flexShrink: 0,
    background: 'rgba(0, 0, 0, 0.2)',
  },
  tab: {
    flex: 1,
    padding: '12px 6px',
    background: 'none',
    border: 'none',
    color: '#9ca3af',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    borderBottom: '2px solid transparent',
  },
  tabActive: {
    color: '#dfb758',
    borderBottom: '2px solid #dfb758',
    background: 'rgba(223, 183, 88, 0.08)',
  },
  panelBody: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
  },
  tabHeader: {
    marginBottom: 14,
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    paddingBottom: 10,
  },
  tabHeading: {
    margin: '0 0 4px',
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#f3f4f6',
  },
  tabDesc: {
    margin: 0,
    fontSize: '0.74rem',
    color: '#9ca3af',
    lineHeight: 1.4,
  },
  subheading: {
    display: 'block',
    color: '#e5e7eb',
    fontSize: '0.78rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
  },
  fieldLabel: {
    display: 'block',
    color: '#9ca3af',
    fontSize: '0.72rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  edgeCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 10px',
    background: 'rgba(223, 183, 88, 0.08)',
    border: '1px solid rgba(223, 183, 88, 0.25)',
    borderRadius: 8,
    marginBottom: 6,
  },
  addBox: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 12,
  },
  curatorialForm: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 12,
  },
  toggleLink: {
    background: 'none',
    border: 'none',
    color: '#dfb758',
    fontSize: '0.74rem',
    cursor: 'pointer',
    padding: '6px 0',
    display: 'block',
    textAlign: 'left',
    marginTop: 4,
  },
  uploadLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(223, 183, 88, 0.2)',
    border: '1px solid rgba(223, 183, 88, 0.4)',
    color: '#ffe29a',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: '0.82rem',
    fontWeight: 700,
  },
  empty: {
    color: '#6b7280',
    fontSize: '0.8rem',
    textAlign: 'center',
    padding: '24px 0',
  },
  emptyBox: {
    color: '#6b7280',
    fontSize: '0.76rem',
    textAlign: 'center',
    padding: '12px 8px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 6,
    margin: '4px 0 8px',
  },
  toast: {
    position: 'fixed',
    top: 20,
    right: 20,
    color: '#fff',
    padding: '10px 20px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: '0.85rem',
    zIndex: 9999,
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
  },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  modal: {
    background: '#16162a',
    border: '1px solid rgba(223, 183, 88, 0.4)',
    borderRadius: 14,
    padding: 24,
    width: '90%',
    maxWidth: 420,
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
  },
};

export default AdminVirtualTour;
