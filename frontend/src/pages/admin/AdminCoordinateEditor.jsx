import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    getNodes, patchNodeCoordinates, getEdges, createEdge, deleteEdge,
    createNode, deleteNode, getFloorPlans, createFloorPlan, updateFloorPlan, deleteFloorPlan, clearFloorPlanData, georeferenceFloorPlan, clearFloorPlanGeoreference, recomputeFloorPlanLatLng, uploadMapImage,
    getRooms, createRoom, updateRoom, deleteRoom, updateBoundaryPoint, createDoorway, deleteDoorway, validateFloorPlanEdges,
    getFootprint, saveFootprint, validateFloorPlan,
    getArtifacts, createArtifact, createQrLocation, getQrLocations,
    getFingerprintCoverage, getRoomFingerprints, deleteFingerprint
} from '../../services/mapApi';
import { QRCodeSVG } from 'qrcode.react';
import { getMuseums, getAdminGalleries, updateAdminGallery, getAdminObjects, getObjects, createAdminObject } from '../../services/api';
import {
    Save, AlertCircle, AlertTriangle, Navigation, MapPin, MousePointerClick, Link2, Trash2,
    ArrowUp, ArrowDown, CheckCircle, CheckCircle2, Sparkles, XCircle, RefreshCw, Table, DoorOpen, ShieldAlert, Layers, Upload, Plus, Edit3, HelpCircle, Filter, Search, Eye, EyeOff,
    QrCode, Package, Printer, X, Ruler, Wifi, Radio
} from 'lucide-react';
import { haversineDistance, mapXyToGps, gpsToMapXy } from '../../utils/geo';
import GeoreferenceModal from '../../components/map/GeoreferenceModal';

const extractErrorMessage = (err, fallback = 'An error occurred') => {
    if (!err) return fallback;
    const errorObj = err.response?.data?.error || err.response?.data || err;
    let raw = fallback;
    if (typeof errorObj === 'string') raw = errorObj;
    else if (errorObj?.message && typeof errorObj.message === 'string') raw = errorObj.message;
    else if (typeof err.message === 'string') raw = err.message;

    if (typeof raw === 'string') {
        const lower = raw.toLowerCase();
        if (lower.includes('ssl syscall') || lower.includes('eof detected') || lower.includes('connection already closed')) {
            return 'Database connection was refreshed after being idle. Please retry your action.';
        }
    }
    return raw;
};

const getPolygonCentroid = (points) => {
    if (!points || points.length === 0) return null;
    let sumX = 0, sumY = 0;
    points.forEach(p => {
        sumX += (p.x <= 1.0 ? p.x * 100 : p.x);
        sumY += (p.y <= 1.0 ? p.y * 100 : p.y);
    });
    return { xPct: sumX / points.length, yPct: sumY / points.length };
};

const isEntrance = (n) => n?.node_type?.split(',').map(s => s.trim()).includes('entrance');
const isExit = (n) => n?.node_type?.split(',').map(s => s.trim()).includes('exit');

export default function AdminCoordinateEditor() {
    const [nodes, setNodes] = useState([]);
    const [selectedNodeId, setSelectedNodeId] = useState('');
    const [lat, setLat] = useState('');
    const [lng, setLng] = useState('');
    const [nodeX, setNodeX] = useState(null);
    const [nodeY, setNodeY] = useState(null);
    const [originalCoords, setOriginalCoords] = useState(null);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [loading, setLoading] = useState(false);
    const [museums, setMuseums] = useState([]);
    const [selectedMuseumId, setSelectedMuseumId] = useState('');

    const [activeTab, setActiveTab] = useState('coordinates');
    const [edges, setEdges] = useState([]);
    const [edgeNodeA, setEdgeNodeA] = useState('');
    const [edgeNodeB, setEdgeNodeB] = useState('');
    const [edgeType, setEdgeType] = useState('normal');
    const [filterFloor, setFilterFloor] = useState('');
    const [selectedEdgeId, setSelectedEdgeId] = useState(null);
    const [edgeFilterQuery, setEdgeFilterQuery] = useState('');
    const [edgeFilterType, setEdgeFilterType] = useState('all');
    const [filterByNodeA, setFilterByNodeA] = useState(false);
    const [hoveredNodeId, setHoveredNodeId] = useState(null);

    const [newNodeName, setNewNodeName] = useState('');
    const [newNodeFloor, setNewNodeFloor] = useState(0);
    const [newNodeType, setNewNodeType] = useState('exhibit');

    const [objects, setObjects] = useState([]);
    const [selectedObjectId, setSelectedObjectId] = useState('');
    const [artifacts, setArtifacts] = useState([]);
    const [selectedArtifactId, setSelectedArtifactId] = useState('');
    const [showNewArtifactModal, setShowNewArtifactModal] = useState(false);
    const [newArtifactForm, setNewArtifactForm] = useState({ name: '', description: '', category: 'Exhibit' });
    const [isCreatingArtifact, setIsCreatingArtifact] = useState(false);

    const [qrLocations, setQrLocations] = useState([]);
    const [qrPayloadInput, setQrPayloadInput] = useState('');
    const [showQrModal, setShowQrModal] = useState(false);
    const [activeQrForModal, setActiveQrForModal] = useState(null);

    const [galleries, setGalleries] = useState([]);
    const [selectedGalleryId, setSelectedGalleryId] = useState('');
    const [polygonPoints, setPolygonPoints] = useState([]);
    const [showNodesInBoundaries, setShowNodesInBoundaries] = useState(false);
    const [userLayerOverrides, setUserLayerOverrides] = useState({});

    // Intelligent layer visibility defaults per active workflow tab, with user override support
    const showPaths = userLayerOverrides.paths !== undefined
        ? userLayerOverrides.paths
        : (activeTab === 'edges');

    const showBoundaries = userLayerOverrides.boundaries !== undefined
        ? userLayerOverrides.boundaries
        : (activeTab === 'boundaries');

    const showNodes = userLayerOverrides.nodes !== undefined
        ? userLayerOverrides.nodes
        : (activeTab === 'coordinates' || activeTab === 'edges' || activeTab === 'create' || (activeTab === 'boundaries' && showNodesInBoundaries));

    const showRoomLabels = userLayerOverrides.labels !== undefined
        ? userLayerOverrides.labels
        : (activeTab === 'boundaries');

    const [floorPlans, setFloorPlans] = useState([]);
    const [selectedFloorPlanId, setSelectedFloorPlanId] = useState('');
    const [showGeoreferenceModal, setShowGeoreferenceModal] = useState(false);
    const [sortCol, setSortCol] = useState('name');
    const [sortDir, setSortDir] = useState('asc');

    const [rooms, setRooms] = useState([]);
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [newRoomName, setNewRoomName] = useState('');
    const [newRoomType, setNewRoomType] = useState('gallery');
    const [newRoomWalkable, setNewRoomWalkable] = useState(true);

    const [doorwayMode, setDoorwayMode] = useState(false);
    const [doorwayPoints, setDoorwayPoints] = useState([]);
    const [pendingDoorway, setPendingDoorway] = useState(null);
    const [doorwayModalOpen, setDoorwayModalOpen] = useState(false);
    const [doorwayName, setDoorwayName] = useState('');
    const [connectedRoomId, setConnectedRoomId] = useState('');
    const [createEntranceNode, setCreateEntranceNode] = useState(true);
    const [invalidEdgeIds, setInvalidEdgeIds] = useState([]);

    const [showNewFloorPlanModal, setShowNewFloorPlanModal] = useState(false);
    const [newPlanName, setNewPlanName] = useState('');
    const [newPlanFloor, setNewPlanFloor] = useState(1);
    const [newPlanMuseumId, setNewPlanMuseumId] = useState('');
    const [newPlanImageFile, setNewPlanImageFile] = useState(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [imageLoadError, setImageLoadError] = useState(false);
    const [editingPointIdx, setEditingPointIdx] = useState(null);
    const [isEditingNodeGps, setIsEditingNodeGps] = useState(false);

  const computeReferenceDistances = (targetLat, targetLng, excludeId = null) => {
    const latNum = parseFloat(targetLat);
    const lngNum = parseFloat(targetLng);
    if (isNaN(latNum) || isNaN(lngNum)) return null;

    let nearestNode = null;
    let minNodeDist = Infinity;
    for (const n of nodes) {
      if (excludeId && n.id === excludeId) continue;
      if (n.latitude != null && n.longitude != null) {
        const d = haversineDistance(latNum, lngNum, n.latitude, n.longitude);
        if (d < minNodeDist) {
          minNodeDist = d;
          nearestNode = n;
        }
      }
    }

    let nearestAnchor = null;
    let minAnchorDist = Infinity;
    if (activeFloorPlan) {
      if (activeFloorPlan.anchor_1_lat != null && activeFloorPlan.anchor_1_lng != null) {
        const d1 = haversineDistance(latNum, lngNum, activeFloorPlan.anchor_1_lat, activeFloorPlan.anchor_1_lng);
        minAnchorDist = d1;
        nearestAnchor = 'Anchor 1';
      }
      if (activeFloorPlan.anchor_2_lat != null && activeFloorPlan.anchor_2_lng != null) {
        const d2 = haversineDistance(latNum, lngNum, activeFloorPlan.anchor_2_lat, activeFloorPlan.anchor_2_lng);
        if (d2 < minAnchorDist) {
          minAnchorDist = d2;
          nearestAnchor = 'Anchor 2';
        }
      }
    }

    return {
      nearestNodeName: nearestNode?.name || null,
      nearestNodeDist: minNodeDist < Infinity ? (minNodeDist < 10 ? minNodeDist.toFixed(1) : Math.round(minNodeDist).toString()) : null,
      nearestAnchorName: nearestAnchor,
      nearestAnchorDist: minAnchorDist < Infinity ? (minAnchorDist < 10 ? minAnchorDist.toFixed(1) : Math.round(minAnchorDist).toString()) : null,
    };
  };

    const [targetRoomId, setTargetRoomId] = useState('');

    const [footprintPoints, setFootprintPoints] = useState([]);
    const [validationReport, setValidationReport] = useState(null);
    const [outOfBoundaryNodeIds, setOutOfBoundaryNodeIds] = useState([]);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [editLat, setEditLat] = useState('');
    const [editLng, setEditLng] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [lastValidationTime, setLastValidationTime] = useState(null);

    const [surveyRoomId, setSurveyRoomId] = useState('');
    const [roomCoverage, setRoomCoverage] = useState(null);
    const [roomFingerprints, setRoomFingerprints] = useState([]);
    const [loadingCoverage, setLoadingCoverage] = useState(false);
    const [surveyClickCoord, setSurveyClickCoord] = useState(null);

    const fetchWifiCoverage = useCallback(async (roomId) => {
        if (!roomId) {
            setRoomCoverage(null);
            setRoomFingerprints([]);
            return;
        }
        setLoadingCoverage(true);
        try {
            const [cov, fps] = await Promise.all([
                getFingerprintCoverage(roomId),
                getRoomFingerprints(roomId)
            ]);
            setRoomCoverage(cov);
            setRoomFingerprints(fps || []);
        } catch (err) {
            console.error('Error fetching WiFi survey data:', err);
        } finally {
            setLoadingCoverage(false);
        }
    }, []);

    const handleDeleteFingerprint = async (id) => {
        if (!window.confirm('Delete this WiFi fingerprint survey point?')) return;
        try {
            await deleteFingerprint(id);
            setMessage({ text: 'Fingerprint deleted successfully', type: 'success' });
            if (surveyRoomId) fetchWifiCoverage(surveyRoomId);
        } catch (err) {
            setMessage({ text: extractErrorMessage(err, 'Failed to delete fingerprint'), type: 'error' });
        }
    };

    const imageRef = useRef(null);
    const imageContainerRef = useRef(null);

    const isPointInsidePolygon = useCallback((x, y, poly) => {
        if (!poly || poly.length < 3 || x == null || y == null) return false;
        const pts = poly.map(p => ({
            x: p.x <= 1.0 ? p.x * 100 : p.x,
            y: p.y <= 1.0 ? p.y * 100 : p.y
        }));
        const px = x <= 1.0 ? x * 100 : x;
        const py = y <= 1.0 ? y * 100 : y;

        let inside = false;
        let p1x = pts[0].x, p1y = pts[0].y;
        for (let i = 0; i <= pts.length; i++) {
            const p2x = pts[i % pts.length].x;
            const p2y = pts[i % pts.length].y;
            if (py > Math.min(p1y, p2y)) {
                if (py <= Math.max(p1y, p2y)) {
                    if (px <= Math.max(p1x, p2x)) {
                        const xinters = p1y !== p2y ? (py - p1y) * (p2x - p1x) / (p2y - p1y) + p1x : p1x;
                        if (p1x === p2x || px <= xinters) {
                            inside = !inside;
                        }
                    }
                }
            }
            p1x = p2x; p1y = p2y;
        }
        return inside;
    }, []);

    const findWallSnapAndAdjacentRoom = useCallback((clickX, clickY, currentRoom, allRooms) => {
        if (!currentRoom || !currentRoom.boundaries || currentRoom.boundaries.length < 3) {
            return {
                snapX: clickX,
                snapY: clickY,
                p1: { x: Math.max(0, clickX - 0.02), y: clickY },
                p2: { x: Math.min(1, clickX + 0.02), y: clickY },
                adjacentRoom: null
            };
        }

        const poly = currentRoom.boundaries.map(b => ({
            x: b.x <= 1.0 ? b.x : b.x / 100,
            y: b.y <= 1.0 ? b.y : b.y / 100
        }));
        const cx = clickX <= 1.0 ? clickX : clickX / 100;
        const cy = clickY <= 1.0 ? clickY : clickY / 100;

        let bestDist = Infinity;
        let bestSnapX = cx;
        let bestSnapY = cy;
        let bestUdx = 1, bestUdy = 0;
        const n = poly.length;

        for (let i = 0; i < n; i++) {
            const b1 = poly[i];
            const b2 = poly[(i + 1) % n];
            const dx = b2.x - b1.x;
            const dy = b2.y - b1.y;
            const segLenSq = dx * dx + dy * dy;
            let t = segLenSq === 0 ? 0 : ((cx - b1.x) * dx + (cy - b1.y) * dy) / segLenSq;
            t = Math.max(0, Math.min(1, t));
            const projX = b1.x + t * dx;
            const projY = b1.y + t * dy;
            const dist = Math.hypot(cx - projX, cy - projY);

            if (dist < bestDist) {
                bestDist = dist;
                bestSnapX = projX;
                bestSnapY = projY;
                const segLen = Math.sqrt(segLenSq) || 1;
                bestUdx = dx / segLen;
                bestUdy = dy / segLen;
            }
        }

        // Standard doorway span along room wall (~2.5% dimension)
        const halfSpan = 0.025;
        const p1 = {
            x: Math.max(0, Math.min(1, bestSnapX - bestUdx * halfSpan)),
            y: Math.max(0, Math.min(1, bestSnapY - bestUdy * halfSpan))
        };
        const p2 = {
            x: Math.max(0, Math.min(1, bestSnapX + bestUdx * halfSpan)),
            y: Math.max(0, Math.min(1, bestSnapY + bestUdy * halfSpan))
        };

        // Probe outward across wall to find adjacent connecting room
        const probeDist = 0.035;
        const probe1 = { x: bestSnapX - bestUdy * probeDist, y: bestSnapY + bestUdx * probeDist };
        const probe2 = { x: bestSnapX + bestUdy * probeDist, y: bestSnapY - bestUdx * probeDist };

        let adjacent = null;
        const otherRooms = (allRooms || []).filter(r => r.id !== currentRoom.id && r.boundaries && r.boundaries.length >= 3);

        for (const r of otherRooms) {
            if (isPointInsidePolygon(probe1.x, probe1.y, r.boundaries) || isPointInsidePolygon(probe2.x, probe2.y, r.boundaries)) {
                adjacent = r;
                break;
            }
        }

        if (!adjacent) {
            let minOtherDist = Infinity;
            for (const r of otherRooms) {
                const rPoly = r.boundaries.map(b => ({
                    x: b.x <= 1.0 ? b.x : b.x / 100,
                    y: b.y <= 1.0 ? b.y : b.y / 100
                }));
                const rn = rPoly.length;
                for (let i = 0; i < rn; i++) {
                    const rb1 = rPoly[i];
                    const rb2 = rPoly[(i + 1) % rn];
                    const rdx = rb2.x - rb1.x;
                    const rdy = rb2.y - rb1.y;
                    const rlenSq = rdx * rdx + rdy * rdy;
                    let rt = rlenSq === 0 ? 0 : ((bestSnapX - rb1.x) * rdx + (bestSnapY - rb1.y) * rdy) / rlenSq;
                    rt = Math.max(0, Math.min(1, rt));
                    const rprojX = rb1.x + rt * rdx;
                    const rprojY = rb1.y + rt * rdy;
                    const rdist = Math.hypot(bestSnapX - rprojX, bestSnapY - rprojY);
                    if (rdist < minOtherDist && rdist < 0.06) {
                        minOtherDist = rdist;
                        adjacent = r;
                    }
                }
            }
        }

        return {
            snapX: bestSnapX,
            snapY: bestSnapY,
            p1,
            p2,
            adjacentRoom: adjacent
        };
    }, [isPointInsidePolygon]);

const containingRooms = useMemo(() => {
    if (nodeX == null || nodeY == null || !rooms || rooms.length === 0) return [];
    return rooms.filter(r => {
        if (!r.boundaries || r.boundaries.length < 3) return false;
        return Boolean(isPointInsidePolygon(nodeX, nodeY, r.boundaries));
    });
}, [nodeX, nodeY, rooms, isPointInsidePolygon]);

const overlappingRoomPairs = useMemo(() => {
    if (!rooms || rooms.length < 2) return [];
    const isOnBoundary = (point, boundaries) => {
        const px = point.x <= 1.0 ? point.x : point.x / 100;
        const py = point.y <= 1.0 ? point.y : point.y / 100;
        for (let i = 0; i < boundaries.length; i++) {
            const a = boundaries[i];
            const b = boundaries[(i + 1) % boundaries.length];
            const ax = a.x <= 1.0 ? a.x : a.x / 100;
            const ay = a.y <= 1.0 ? a.y : a.y / 100;
            const bx = b.x <= 1.0 ? b.x : b.x / 100;
            const by = b.y <= 1.0 ? b.y : b.y / 100;
            const dx = bx - ax;
            const dy = by - ay;
            const lengthSq = dx * dx + dy * dy;
            const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
            const closestX = ax + t * dx;
            const closestY = ay + t * dy;
            if (Math.hypot(px - closestX, py - closestY) <= 0.0005) return true;
        }
        return false;
    };
    const pairs = [];
    for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
            const r1 = rooms[i];
            const r2 = rooms[j];
            if (!r1.boundaries || r1.boundaries.length < 3) continue;
            if (!r2.boundaries || r2.boundaries.length < 3) continue;
            const r1InR2 = r1.boundaries.some(b => !isOnBoundary(b, r2.boundaries) && isPointInsidePolygon(b.x, b.y, r2.boundaries));
            const r2InR1 = r2.boundaries.some(b => !isOnBoundary(b, r1.boundaries) && isPointInsidePolygon(b.x, b.y, r1.boundaries));
            if (r1InR2 || r2InR1) {
                pairs.push({ roomA: r1, roomB: r2 });
            }
        }
    }
    return pairs;
}, [rooms, isPointInsidePolygon]);

const isEntranceNode = useCallback((node) => {
    if (!node) return false;
    const type = (node.node_type || '').toLowerCase();
    const name = (node.name || '').toLowerCase();
    return (
        type === 'entrance' ||
        type.includes('entrance') ||
        type === 'doorway' ||
        type === 'door' ||
        type.includes('door') ||
        name.includes('entrance') ||
        name.includes('door') ||
        name.startsWith('room')
    );
}, []);

const getNodeRoom = useCallback((node) => {
    if (!node || !rooms) return null;
    const nx = (node.x_coordinate <= 1.0 ? node.x_coordinate * 100 : node.x_coordinate) || 0;
    const ny = (node.y_coordinate <= 1.0 ? node.y_coordinate * 100 : node.y_coordinate) || 0;
    return rooms.find(r => r.boundaries && r.boundaries.length >= 3 && isPointInsidePolygon(nx, ny, r.boundaries)) || null;
}, [rooms, isPointInsidePolygon]);

const checkWallCrossing = useCallback((n1, n2) => {
    if (!n1 || !n2 || !rooms || rooms.length === 0) {
        return { blocked: false };
    }

    const x1 = (n1.x_coordinate <= 1.0 ? n1.x_coordinate : n1.x_coordinate / 100) || 0;
    const y1 = (n1.y_coordinate <= 1.0 ? n1.y_coordinate : n1.y_coordinate / 100) || 0;
    const x2 = (n2.x_coordinate <= 1.0 ? n2.x_coordinate : n2.x_coordinate / 100) || 0;
    const y2 = (n2.y_coordinate <= 1.0 ? n2.y_coordinate : n2.y_coordinate / 100) || 0;

    const allDoorways = [];
    rooms.forEach(r => {
        if (r.doorways) {
            r.doorways.forEach(d => {
                allDoorways.push({
                    x1: d.x1 <= 1.0 ? d.x1 : d.x1 / 100,
                    y1: d.y1 <= 1.0 ? d.y1 : d.y1 / 100,
                    x2: d.x2 <= 1.0 ? d.x2 : d.x2 / 100,
                    y2: d.y2 <= 1.0 ? d.y2 : d.y2 / 100
                });
            });
        }
    });

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    for (const r of rooms) {
        if (!r.boundaries || r.boundaries.length < 3) continue;
        const poly = r.boundaries.map(b => ({
            x: b.x <= 1.0 ? b.x : b.x / 100,
            y: b.y <= 1.0 ? b.y : b.y / 100
        }));

        if (!r.walkable) {
            if (isPointInsidePolygon(x1, y1, poly) || isPointInsidePolygon(x2, y2, poly) || isPointInsidePolygon(midX, midY, poly)) {
                return { blocked: true, roomName: r.name, reason: 'Non-walkable room' };
            }
        }

        const n = poly.length;
        for (let i = 0; i < n; i++) {
            const b1 = poly[i];
            const b2 = poly[(i + 1) % n];

            const denom = (b2.y - b1.y) * (x2 - x1) - (b2.x - b1.x) * (y2 - y1);
            if (Math.abs(denom) > 1e-12) {
                const ua = ((b2.x - b1.x) * (y1 - b1.y) - (b2.y - b1.y) * (x1 - b1.x)) / denom;
                const ub = ((x2 - x1) * (y1 - b1.y) - (y2 - y1) * (x1 - b1.x)) / denom;

                if (1e-5 <= ua && ua <= 1.0 - 1e-5 && 1e-5 <= ub && ub <= 1.0 - 1e-5) {
                    const ix = x1 + ua * (x2 - x1);
                    const iy = y1 + ua * (y2 - y1);

                    // REQUIRE ENTRANCE NODE: A path can ONLY cross room walls if entering/exiting through an entrance node!
                    // Direct room-to-room auto connection without an entrance node is disallowed.
                    const n1IsEnt = isEntranceNode(n1);
                    const n2IsEnt = isEntranceNode(n2);

                    if (!n1IsEnt && !n2IsEnt) {
                        return {
                            blocked: true,
                            roomName: r.name,
                            reason: 'Direct room-to-room connection not allowed. Paths can only enter or exit rooms through an Entrance node.',
                            collisionPoint: { x: ix * 100, y: iy * 100 }
                        };
                    }

                    // If one endpoint is an entrance node, verify it is positioned near the wall opening/doorway
                    let passesDoorway = false;
                    for (const d of allDoorways) {
                        const dx = d.x2 - d.x1;
                        const dy = d.y2 - d.y1;
                        let t = dx === 0 && dy === 0 ? 0 : ((ix - d.x1) * dx + (iy - d.y1) * dy) / (dx * dx + dy * dy);
                        t = Math.max(0, Math.min(1, t));
                        const cx = d.x1 + t * dx;
                        const cy = d.y1 + t * dy;
                        if (Math.hypot(ix - cx, iy - cy) <= 0.08) {
                            passesDoorway = true;
                            break;
                        }
                    }

                    if (!passesDoorway) {
                        const distToN1 = Math.hypot(ix - x1, iy - y1);
                        const distToN2 = Math.hypot(ix - x2, iy - y2);
                        if ((n1IsEnt && distToN1 <= 0.15) || (n2IsEnt && distToN2 <= 0.15)) {
                            passesDoorway = true;
                        }
                    }

                    if (!passesDoorway) {
                        return {
                            blocked: true,
                            roomName: r.name,
                            reason: 'Wall blocked. Entrance node must be located at the wall opening.',
                            collisionPoint: { x: ix * 100, y: iy * 100 }
                        };
                    }
                }
            }
        }
    }

    return { blocked: false };
}, [rooms, isPointInsidePolygon]);

const nodeA = useMemo(() => nodes.find(n => n.id === edgeNodeA), [nodes, edgeNodeA]);
const targetNodeId = hoveredNodeId && activeTab === 'edges' && hoveredNodeId !== edgeNodeA ? hoveredNodeId : edgeNodeB;
const nodeB = useMemo(() => nodes.find(n => n.id === targetNodeId), [nodes, targetNodeId]);
const currentConnectionStatus = useMemo(() => {
    if (!nodeA || !nodeB) return null;
    return checkWallCrossing(nodeA, nodeB);
}, [nodeA, nodeB, checkWallCrossing]);

const reachableEntranceNodes = useMemo(() => {
    if (!nodeA || activeTab !== 'edges') return [];
    return nodes.filter(n => n.id !== nodeA.id && isEntranceNode(n) && !checkWallCrossing(nodeA, n).blocked);
}, [nodeA, nodes, activeTab, isEntranceNode, checkWallCrossing]);

const filteredEdges = useMemo(() => {
    if (!edges) return [];
    return edges.filter(edge => {
        const n1 = nodes.find(n => n.id === edge.from_node_id);
        const n2 = nodes.find(n => n.id === edge.to_node_id);

        if (edgeFilterType === 'invalid' && !invalidEdgeIds.includes(edge.id)) return false;
        if (edgeFilterType === 'entrance') {
            const isEnt = (n1 && isEntranceNode(n1)) || (n2 && isEntranceNode(n2));
            if (!isEnt) return false;
        } else if (edgeFilterType !== 'all' && edgeFilterType !== 'invalid' && (edge.edge_type || 'normal') !== edgeFilterType) return false;

        if (filterByNodeA && edgeNodeA && edge.from_node_id !== edgeNodeA && edge.to_node_id !== edgeNodeA) return false;

        if (!edgeFilterQuery) return true;
        const q = edgeFilterQuery.toLowerCase().trim();
        const n1Name = n1 ? n1.name.toLowerCase() : '';
        const n2Name = n2 ? n2.name.toLowerCase() : '';
        const eType = (edge.edge_type || 'normal').toLowerCase();
        return n1Name.includes(q) || n2Name.includes(q) || eType.includes(q) || String(edge.id).includes(q);
    });
}, [edges, nodes, edgeFilterType, edgeFilterQuery, edgeNodeA, filterByNodeA, invalidEdgeIds, isEntranceNode]);

const handleUseGPSForPoint = () => {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setEditLat(pos.coords.latitude.toFixed(7));
                setEditLng(pos.coords.longitude.toFixed(7));
                setMessage({ text: `GPS location acquired: (${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)})`, type: 'success' });
            },
            (err) => {
                setMessage({ text: `Failed to get GPS location. ${err.message}`, type: 'error' });
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    } else {
        setMessage({ text: "Geolocation is not supported by this browser.", type: "error" });
    }
};

const handleSavePointCorrection = async (idx, newLatStr, newLngStr) => {
    const pt = polygonPoints[idx];
    if (!pt) return;

    const parsedLat = parseFloat(newLatStr);
    const parsedLng = parseFloat(newLngStr);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
        setMessage({ text: 'Please enter valid numbers for latitude and longitude.', type: 'error' });
        return;
    }

    if (!isGeoreferenced) {
        setMessage({ text: 'Set anchors before manually correcting GPS coordinates.', type: 'error' });
        return;
    }

    setLoading(true);
    try {
        const roomForPt = rooms.find(r => r.boundaries && r.boundaries.some(b => b.id === pt.id)) || rooms.find(r => r.id === pt.roomId);
        if (roomForPt && pt.id) {
            const res = await updateBoundaryPoint(roomForPt.id, pt.id, {
                latitude: parsedLat,
                longitude: parsedLng
            });
            if (res.data) {
                const updatedPoint = res.data;
                setPolygonPoints(prev => prev.map((p, i) => i === idx ? {
                    ...p,
                    x: updatedPoint.x,
                    y: updatedPoint.y,
                    lat: updatedPoint.latitude,
                    lng: updatedPoint.longitude,
                    is_manually_corrected: updatedPoint.is_manually_corrected,
                    corrected_at: updatedPoint.corrected_at
                } : p));
                setMessage({ text: `Point ${idx + 1} precision GPS saved! Position updated on map.`, type: 'success' });
                if (activeFloorPlan) fetchRoomsForFloorPlan(activeFloorPlan.id);
            }
        } else {
            let newX = pt.x;
            let newY = pt.y;
            if (activeFloorPlan && activeFloorPlan.anchor_1_lat != null && activeFloorPlan.anchor_2_lat != null) {
                const dlat = activeFloorPlan.anchor_2_lat - activeFloorPlan.anchor_1_lat;
                const dlng = activeFloorPlan.anchor_2_lng - activeFloorPlan.anchor_1_lng;
                const dx_px = activeFloorPlan.anchor_2_x_px - activeFloorPlan.anchor_1_x_px;
                const dy_px = activeFloorPlan.anchor_2_y_px - activeFloorPlan.anchor_1_y_px;
                const w = parseFloat(activeFloorPlan.width_px || 1000);
                const h = parseFloat(activeFloorPlan.height_px || 1000);

                const ry = dlat !== 0 ? (parsedLat - activeFloorPlan.anchor_1_lat) / dlat : 0.0;
                const rx = dlng !== 0 ? (parsedLng - activeFloorPlan.anchor_1_lng) / dlng : 0.0;
                const px = activeFloorPlan.anchor_1_x_px + rx * dx_px;
                const py = activeFloorPlan.anchor_1_y_px + ry * dy_px;
                newX = px / w;
                newY = py / h;
            }

            setPolygonPoints(prev => prev.map((p, i) => i === idx ? {
                ...p,
                x: newX,
                y: newY,
                lat: parsedLat,
                lng: parsedLng,
                is_manually_corrected: true
            } : p));
            setMessage({ text: `Draft Point ${idx + 1} corrected to (${parsedLat.toFixed(6)}, ${parsedLng.toFixed(6)})!`, type: 'success' });
        }
        setEditingPointIdx(null);
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to update boundary point'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleRevertPointCorrection = async (idx) => {
    const pt = polygonPoints[idx];
    if (!pt) return;

    setLoading(true);
    try {
        const roomForPt = rooms.find(r => r.boundaries && r.boundaries.some(b => b.id === pt.id)) || rooms.find(r => r.id === pt.roomId);
        if (roomForPt && pt.id) {
            const res = await updateBoundaryPoint(roomForPt.id, pt.id, {
                revert: true,
                x: pt.x,
                y: pt.y
            });
            if (res.data) {
                const updatedPoint = res.data;
                setPolygonPoints(prev => prev.map((p, i) => i === idx ? {
                    ...p,
                    lat: updatedPoint.latitude,
                    lng: updatedPoint.longitude,
                    is_manually_corrected: false,
                    corrected_at: null
                } : p));
                setMessage({ text: `Point ${idx + 1} reverted to derived coordinates.`, type: 'success' });
                if (activeFloorPlan) fetchRoomsForFloorPlan(activeFloorPlan.id);
            }
        } else {
            const gps = activeFloorPlan ? mapXyToGps(pt.x, pt.y, activeFloorPlan) : { lat: null, lng: null };
            setPolygonPoints(prev => prev.map((p, i) => i === idx ? {
                ...p,
                lat: gps.lat,
                lng: gps.lng,
                is_manually_corrected: false
            } : p));
            setMessage({ text: `Draft Point ${idx + 1} reverted to derived coordinates.`, type: 'success' });
        }
        setEditingPointIdx(null);
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to revert boundary point'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const getFloorPlanImageUrl = useCallback((url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const mapApiBase = import.meta.env.VITE_MAP_API_URL || (typeof window !== 'undefined' ? `http://${window.location.hostname}:5001/api` : 'http://127.0.0.1:5001/api');
    const host = mapApiBase.replace(/\/api\/?$/, '');
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${host}${cleanUrl}`;
}, []);

const getSortedPolygonPoints = useCallback((pts) => {
    if (!pts || pts.length < 3) return pts;
    let sumX = 0, sumY = 0;
    pts.forEach(p => {
        const x = p.x != null ? (p.x <= 1.0 ? p.x * 100 : p.x) : 0;
        const y = p.y != null ? (p.y <= 1.0 ? p.y * 100 : p.y) : 0;
        sumX += x;
        sumY += y;
    });
    const cx = sumX / pts.length;
    const cy = sumY / pts.length;

    return [...pts].sort((a, b) => {
        const ax = a.x != null ? (a.x <= 1.0 ? a.x * 100 : a.x) : 0;
        const ay = a.y != null ? (a.y <= 1.0 ? a.y * 100 : a.y) : 0;
        const bx = b.x != null ? (b.x <= 1.0 ? b.x * 100 : b.x) : 0;
        const by = b.y != null ? (b.y <= 1.0 ? b.y * 100 : b.y) : 0;

        const angleA = Math.atan2(ay - cy, ax - cx);
        const angleB = Math.atan2(by - cy, bx - cx);
        return angleA - angleB;
    });
}, []);

const handleDirectImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeFloorPlan) return;
    setIsUploadingImage(true);
    try {
        let width_px = undefined;
        let height_px = undefined;
        try {
            const objectUrl = URL.createObjectURL(file);
            const img = new Image();
            await new Promise((resolve) => {
                img.onload = () => {
                    width_px = img.naturalWidth;
                    height_px = img.naturalHeight;
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = objectUrl;
            });
            URL.revokeObjectURL(objectUrl);
        } catch (dimErr) {
            console.warn('Could not read image dimensions:', dimErr);
        }

        const uploadRes = await uploadMapImage(file);
        const url = uploadRes.url || uploadRes.image_url;
        if (url) {
            // Check if floor plan has existing marks/boundaries
            const hasExistingData = nodes.length > 0 || rooms.length > 0 || edges.length > 0;
            if (hasExistingData) {
                const shouldClear = window.confirm(
                    `You uploaded a new image for "${activeFloorPlan.name}" (Floor ${activeFloorPlan.floor_number}).\n\nWould you like to clear previous room marks, boundaries, and walkpaths for a clean slate on this unique floor plan?\n\n• OK = Clear previous marks & paths (Recommended for new floor layout)\n• Cancel = Keep existing marks at their old positions`
                );
                if (shouldClear) {
                    try {
                        await clearFloorPlanData(activeFloorPlan.id);
                        setNodes([]);
                        setEdges([]);
                        setRooms([]);
                    } catch (clearErr) {
                        console.warn('Failed to clear previous floor plan data:', clearErr);
                    }
                }
            }

            const payload = { image_url: url };
            if (width_px && height_px) {
                payload.width_px = width_px;
                payload.height_px = height_px;
            }
            await updateFloorPlan(activeFloorPlan.id, payload);
            setImageLoadError(false);
            setMessage({ text: `Floor plan image uploaded successfully for "${activeFloorPlan.name}" (Floor ${activeFloorPlan.floor_number})!`, type: 'success' });
            const currentPlanId = activeFloorPlan.id;
            await fetchFloorPlans(selectedMuseumId);
            setSelectedFloorPlanId(currentPlanId);
            await fetchNodes(currentPlanId);
            await fetchEdges(currentPlanId, activeFloorPlan.museum_id || selectedMuseumId);
            await fetchRoomsForFloorPlan(currentPlanId);
        }
    } catch (err) {
        setMessage({ text: 'Failed to upload floor plan image.', type: 'error' });
    } finally {
        setIsUploadingImage(false);
        if (e.target) e.target.value = '';
    }
};

const handleClearFloorPlanData = async () => {
    if (!activeFloorPlan) return;
    const confirmed = window.confirm(
        `Clear all marks, room boundaries, and walkpaths for "${activeFloorPlan.name}" (Floor ${activeFloorPlan.floor_number})?\n\nThis will give you a clean slate to implement this floor/room uniquely without confusing previous marks.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
        await clearFloorPlanData(activeFloorPlan.id);
        setNodes([]);
        setEdges([]);
        setRooms([]);
        setFootprintPoints([]);
        setPolygonPoints([]);
        setSelectedNodeId('');
        setSelectedEdgeId(null);
        setMessage({ text: `All marks, room boundaries, and paths for "${activeFloorPlan.name}" have been cleared! Clean slate ready.`, type: 'success' });
        await fetchNodes(activeFloorPlan.id);
        await fetchEdges(activeFloorPlan.id, activeFloorPlan.museum_id || selectedMuseumId);
        await fetchRoomsForFloorPlan(activeFloorPlan.id);
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to clear floor plan data'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleDeleteFloorPlanImage = async () => {
    if (!activeFloorPlan) return;
    const confirmed = window.confirm(
        `Are you sure you want to remove the floor plan image for "${activeFloorPlan.name}" (Floor ${activeFloorPlan.floor_number})?\n\nThis will remove the schematic diagram while preserving all existing nodes, paths, and room boundaries.`
    );
    if (!confirmed) return;

    setIsUploadingImage(true);
    try {
        await updateFloorPlan(activeFloorPlan.id, { image_url: null });
        setImageLoadError(false);
        setMessage({ text: `Floor plan image for "${activeFloorPlan.name}" removed successfully.`, type: 'success' });
        const currentPlanId = activeFloorPlan.id;
        await fetchFloorPlans(selectedMuseumId);
        setSelectedFloorPlanId(currentPlanId);
    } catch (err) {
        setMessage({ text: err.response?.data?.error || 'Failed to remove floor plan image.', type: 'error' });
    } finally {
        setIsUploadingImage(false);
    }
};

const handleDeleteFloorPlan = async () => {
    if (!activeFloorPlan) return;
    const confirmed = window.confirm(
        `Are you sure you want to completely delete floor plan "${activeFloorPlan.name}" (Floor ${activeFloorPlan.floor_number})?\n\nWARNING: All room boundaries and floor configuration for this level will be permanently removed.`
    );
    if (!confirmed) return;

    setLoading(true);
    try {
        await deleteFloorPlan(activeFloorPlan.id);
        setMessage({ text: `Floor plan "${activeFloorPlan.name}" deleted successfully.`, type: 'success' });
        setSelectedFloorPlanId('');
        await fetchFloorPlans(selectedMuseumId);
        if (selectedMuseumId) {
            await fetchNodes(null, selectedMuseumId);
            await fetchEdges(selectedMuseumId);
        }
    } catch (err) {
        setMessage({ text: err.response?.data?.error || 'Failed to delete floor plan.', type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleCreateFloorPlanSubmit = async (e) => {
    e.preventDefault();
    if (!newPlanName) return;
    setLoading(true);
    try {
        const targetMuseumId = newPlanMuseumId || selectedMuseumId;
        let imageUrl = null;
        let width_px = null;
        let height_px = null;

        if (newPlanImageFile) {
            try {
                const objectUrl = URL.createObjectURL(newPlanImageFile);
                await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        width_px = img.naturalWidth;
                        height_px = img.naturalHeight;
                        resolve();
                    };
                    img.onerror = () => resolve();
                    img.src = objectUrl;
                });
                URL.revokeObjectURL(objectUrl);
            } catch (_) {}

            const uploadRes = await uploadMapImage(newPlanImageFile);
            imageUrl = uploadRes.url || uploadRes.image_url;
        }

        const payload = {
            name: newPlanName,
            floor_number: Number(newPlanFloor),
            museum_id: targetMuseumId ? parseInt(targetMuseumId) : null
        };
        if (imageUrl) {
            payload.image_url = imageUrl;
            if (width_px && height_px) {
                payload.width_px = width_px;
                payload.height_px = height_px;
            }
        }

        const res = await createFloorPlan(payload);
        setMessage({ text: `Floor plan "${newPlanName}" (Floor ${newPlanFloor}) created successfully!`, type: 'success' });
        setShowNewFloorPlanModal(false);
        setNewPlanName('');
        setNewPlanImageFile(null);

        const newId = res?.data?.id;
        if (targetMuseumId && targetMuseumId !== selectedMuseumId) {
            setSelectedMuseumId(targetMuseumId);
            await fetchFloorPlans(targetMuseumId);
        } else {
            await fetchFloorPlans(selectedMuseumId);
        }
        if (newId) setSelectedFloorPlanId(newId);
    } catch (err) {
        setMessage({ text: err.response?.data?.error || 'Failed to create floor plan', type: 'error' });
    } finally {
        setLoading(false);
    }
};

const activeFloorPlan = useMemo(() => {
    if (!floorPlans.length) return null;
    if (selectedFloorPlanId) {
        const match = floorPlans.find(fp => String(fp.id) === String(selectedFloorPlanId));
        if (match) return match;
    }
    if (filterFloor !== '') {
        const matchFloor = floorPlans.find(fp => fp.floor_number === Number(filterFloor));
        if (matchFloor) return matchFloor;
    }
    return floorPlans[0];
}, [floorPlans, selectedFloorPlanId, filterFloor]);

const activeMuseum = useMemo(() => {
    return museums.find(m => m.id.toString() === selectedMuseumId.toString()) || null;
}, [museums, selectedMuseumId]);

const verifiedReferencePointsCount = useMemo(() => {
    if (!activeFloorPlan) return 0;
    let count = 0;
    if (activeFloorPlan.anchor_1_lat != null && activeFloorPlan.anchor_1_lng != null) count++;
    if (activeFloorPlan.anchor_2_lat != null && activeFloorPlan.anchor_2_lng != null) count++;
    if (activeFloorPlan.anchor_3_lat != null && activeFloorPlan.anchor_3_lng != null) count++;
    if (activeFloorPlan.anchor_4_lat != null && activeFloorPlan.anchor_4_lng != null) count++;
    return count;
}, [activeFloorPlan]);

const isGeoreferenced = useMemo(() => {
    return verifiedReferencePointsCount >= 2;
}, [verifiedReferencePointsCount]);

const calibrationDiscrepancy = useMemo(() => {
    if (!activeFloorPlan || verifiedReferencePointsCount < 2) return null;
    const a1_x = activeFloorPlan.anchor_1_x_px;
    const a1_y = activeFloorPlan.anchor_1_y_px;
    const a2_x = activeFloorPlan.anchor_2_x_px;
    const a2_y = activeFloorPlan.anchor_2_y_px;
    const lat1 = activeFloorPlan.anchor_1_lat;
    const lng1 = activeFloorPlan.anchor_1_lng;
    const lat2 = activeFloorPlan.anchor_2_lat;
    const lng2 = activeFloorPlan.anchor_2_lng;
    if (a1_x == null || a1_y == null || a2_x == null || a2_y == null || lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;

    const dx = a2_x - a1_x;
    const dy = a2_y - a1_y;
    const dPx = Math.sqrt(dx * dx + dy * dy);
    if (dPx <= 0) return null;

    const dGeo = haversineDistance(lat1, lng1, lat2, lng2);
    const calibratedScale = dGeo / dPx;
    const knownScale = parseFloat(activeFloorPlan.scale_meters_per_px || 0);

    if (knownScale > 0) {
        const diffPercent = Math.abs(calibratedScale - knownScale) / knownScale * 100;
        return {
            calibratedScale,
            knownScale,
            diffPercent,
            isWarning: diffPercent > 15.0
        };
    }
    return null;
}, [activeFloorPlan, verifiedReferencePointsCount]);

const fetchRoomsForFloorPlan = useCallback(async (fpId) => {
    if (!fpId) return;
    try {
        const res = await getRooms(fpId);
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setRooms(list);
    } catch (err) {
        console.error('Error fetching rooms:', err);
    }
}, []);

const fetchFootprintForFloorPlan = useCallback(async (fpId) => {
    if (!fpId) {
        setFootprintPoints([]);
        return;
    }
    try {
        const res = await getFootprint(fpId);
        if (res.data && res.data.points) {
            setFootprintPoints(res.data.points);
        } else {
            setFootprintPoints([]);
        }
    } catch (err) {
        console.error("Failed to load footprint:", err);
        setFootprintPoints([]);
    }
}, []);

const fetchArtifacts = useCallback(async (floorPlanId) => {
    if (!floorPlanId) {
        setArtifacts([]);
        return;
    }
    try {
        const res = await getArtifacts(floorPlanId);
        setArtifacts(res.data || []);
    } catch (err) {
        console.error("Failed to load artifacts:", err);
        setArtifacts([]);
    }
}, []);

const fetchObjects = useCallback(async (museumId) => {
    const targetMuseumId = museumId || selectedMuseumId || activeFloorPlan?.museum_id;
    try {
        const params = {};
        if (targetMuseumId) {
            params.museum_id = targetMuseumId;
        }
        let data = [];
        try {
            const res = await getAdminObjects(params);
            data = res?.data || res || [];
        } catch (adminErr) {
            const pubRes = await getObjects(params);
            data = pubRes?.data || pubRes || [];
        }
        setObjects(Array.isArray(data) ? data : []);
    } catch (err) {
        console.error("Failed to load objects:", err);
        setObjects([]);
    }
}, [selectedMuseumId, activeFloorPlan]);

const fetchQrs = useCallback(async () => {
    try {
        const res = await getQrLocations();
        setQrLocations(res.data || []);
    } catch (err) {
        console.error("Failed to load QR locations:", err);
        setQrLocations([]);
    }
}, []);

useEffect(() => {
    setImageLoadError(false);
    // Immediately clear canvas state so previous floor plan's data never lingers or shows
    setNodes([]);
    setEdges([]);
    setRooms([]);
    setFootprintPoints([]);
    setPolygonPoints([]);
    setSelectedNodeId('');
    setSelectedEdgeId(null);
    setOutOfBoundaryNodeIds([]);
    setInvalidEdgeIds([]);
    setUserLayerOverrides({});

    if (activeFloorPlan?.id) {
        fetchRoomsForFloorPlan(activeFloorPlan.id);
        fetchFootprintForFloorPlan(activeFloorPlan.id);
        fetchArtifacts(activeFloorPlan.id);
        fetchObjects(activeFloorPlan.museum_id || selectedMuseumId);
        fetchQrs();
        // Reload nodes and edges strictly scoped to this floor plan
        fetchNodes(activeFloorPlan.id);
        fetchEdges(activeFloorPlan.id, activeFloorPlan.museum_id || selectedMuseumId);
    }
}, [activeFloorPlan?.id, selectedMuseumId, fetchRoomsForFloorPlan, fetchFootprintForFloorPlan, fetchArtifacts, fetchObjects, fetchQrs]);

const handleSaveFootprint = async () => {
    if (!activeFloorPlan) return;
    if (footprintPoints.length < 3) {
        setMessage({ text: 'A building footprint must have at least 3 corner points.', type: 'error' });
        return;
    }
    setLoading(true);
    try {
        const sortedPoints = getSortedPolygonPoints(footprintPoints);
        const res = await saveFootprint(activeFloorPlan.id, sortedPoints);
        if (res.data && res.data.points) {
            setFootprintPoints(res.data.points);
        }
        setMessage({ text: 'Building footprint boundary saved successfully!', type: 'success' });
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to save building footprint'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleValidateAll = async () => {
    const planId = activeFloorPlan?.id || selectedFloorPlanId;
    if (!planId) {
        setMessage({ text: 'Please select a floor plan first.', type: 'error' });
        return;
    }
    setLoading(true);
    try {
        const res = await validateFloorPlan(planId);
        setValidationReport(res);
        setLastValidationTime(new Date());
        if (res.invalid_edges) {
            setInvalidEdgeIds(res.invalid_edges.map(e => e.edge_id));
        }
        if (res.out_of_boundary_nodes) {
            setOutOfBoundaryNodeIds(res.out_of_boundary_nodes.map(n => n.node_id));
        }
        setShowValidationModal(true);
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Validation failed'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleValidatePaths = async () => {
    const planId = activeFloorPlan?.id || selectedFloorPlanId;
    if (!planId) {
        setMessage({ text: 'Please select a floor plan first.', type: 'error' });
        return;
    }
    setLoading(true);
    try {
        const res = await validateFloorPlanEdges(planId);
        const flagged = res.invalid_edges || [];
        setInvalidEdgeIds(flagged.map(e => e.edge_id));
        if (flagged.length > 0) {
            setMessage({
                text: `Path Integrity Alert: ${flagged.length} edge(s) cross room boundaries! Marked in RED on map.`,
                type: 'error'
            });
        } else {
            setMessage({
                text: `Validation Passed! All ${res.total_edges} edge(s) respect room walls & doorway openings.`,
                type: 'success'
            });
        }
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Validation failed'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const fetchFloorPlans = async (mId) => {
    if (!mId) { setFloorPlans([]); setSelectedFloorPlanId(''); return; }
    try {
        const res = await getFloorPlans(mId);
        const plansList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setFloorPlans(plansList);
        setSelectedFloorPlanId(prev => {
            const exists = plansList.find(p => String(p.id) === String(prev));
            return exists ? prev : (plansList[0]?.id || '');
        });
    } catch (err) { console.error('[fetchFloorPlans] error:', err); }
};

const handleRecomputeLatLng = async () => {
    const planId = activeFloorPlan?.id || selectedFloorPlanId;
    if (!planId) {
        setMessage({ text: 'Please select a floor plan first.', type: 'error' });
        return;
    }
    setLoading(true);
    try {
        const res = await recomputeFloorPlanLatLng(planId);
        if (res.warning) {
            setMessage({ text: res.warning, type: 'error' });
        } else {
            setMessage({ text: res.message || `Updated ${res.updated_count} nodes with derived real-world coordinates!`, type: 'success' });
            await fetchNodes();
            await fetchEdges();
        }
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to recompute coordinates'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleGeoreferenceSave = async (anchors) => {
    if (!activeFloorPlan) return;
    try {
        setLoading(true);
        const payload = {
            anchors: (anchors || []).map(a => ({
                map_x: parseFloat(a.map_x),
                map_y: parseFloat(a.map_y),
                latitude: parseFloat(a.latitude),
                longitude: parseFloat(a.longitude)
            })),
            anchor_1_x_px: anchors[0]?.map_x ?? 0,
            anchor_1_y_px: anchors[0]?.map_y ?? 0,
            anchor_1_lat: parseFloat(anchors[0]?.latitude ?? 0),
            anchor_1_lng: parseFloat(anchors[0]?.longitude ?? 0),
            anchor_2_x_px: anchors[1]?.map_x ?? 0,
            anchor_2_y_px: anchors[1]?.map_y ?? 0,
            anchor_2_lat: parseFloat(anchors[1]?.latitude ?? 0),
            anchor_2_lng: parseFloat(anchors[1]?.longitude ?? 0),
        };
        if (anchors[2]) {
            payload.anchor_3_x_px = anchors[2].map_x;
            payload.anchor_3_y_px = anchors[2].map_y;
            payload.anchor_3_lat = parseFloat(anchors[2].latitude);
            payload.anchor_3_lng = parseFloat(anchors[2].longitude);
        }
        if (anchors[3]) {
            payload.anchor_4_x_px = anchors[3].map_x;
            payload.anchor_4_y_px = anchors[3].map_y;
            payload.anchor_4_lat = parseFloat(anchors[3].latitude);
            payload.anchor_4_lng = parseFloat(anchors[3].longitude);
        }

        await georeferenceFloorPlan(activeFloorPlan.id, payload);
        setShowGeoreferenceModal(false);

        const recomputeRes = await recomputeFloorPlanLatLng(activeFloorPlan.id);
        setMessage({ text: recomputeRes.message || 'Floor plan georeferenced & nodes updated!', type: 'success' });
        await fetchFloorPlans(selectedMuseumId);
        await fetchNodes();
        await fetchEdges();
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to save georeferencing'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleGeoreferenceClear = async () => {
    if (!activeFloorPlan) return;
    if (!window.confirm('Remove GPS coordinates and anchors from this floor plan? All nodes and edges on this floor plan will operate in pure indoor (X, Y) mode.')) return;
    try {
        setLoading(true);
        await clearFloorPlanGeoreference(activeFloorPlan.id);
        setShowGeoreferenceModal(false);
        setLat('');
        setLng('');
        setMessage({ text: 'Floor plan GPS coordinates and anchors removed. Map is now in indoor (X, Y) mode.', type: 'success' });
        await fetchFloorPlans(selectedMuseumId);
        await fetchNodes();
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to clear georeference'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleSort = (col) => {
    if (sortCol === col) {
        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
        setSortCol(col);
        setSortDir('asc');
    }
};

const filteredNodes = useMemo(() => {
    return filterFloor !== '' ? nodes.filter(n => n.floor === Number(filterFloor)) : nodes;
}, [nodes, filterFloor]);

const sortedAuditNodes = useMemo(() => {
    return [...filteredNodes].sort((a, b) => {
        let valA = a[sortCol];
        let valB = b[sortCol];
        if (valA == null) return sortDir === 'asc' ? 1 : -1;
        if (valB == null) return sortDir === 'asc' ? -1 : 1;
        if (typeof valA === 'string') {
            return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortDir === 'asc' ? valA - valB : valB - valA;
    });
}, [filteredNodes, sortCol, sortDir]);

const removePoint = (i) => {
    setPolygonPoints(prev => prev.filter((_, idx) => idx !== i));
};

const movePoint = (i, dir) => {
    setPolygonPoints(prev => {
        const next = [...prev];
        const temp = next[i];
        next[i] = next[i + dir];
        next[i + dir] = temp;
        return next;
    });
};

const selectGalleryById = (id, galleryList = galleries) => {
    setSelectedGalleryId(id.toString());
    const gallery = galleryList.find(g => g.id.toString() === id.toString());
    if (gallery && gallery.boundary_polygon && Array.isArray(gallery.boundary_polygon)) {
        const mapped = gallery.boundary_polygon.map(p => ({
            x: p.x != null ? p.x : (p.lng ? (p.lng <= 1.0 ? p.lng : 0.5) : 0.5),
            y: p.y != null ? p.y : (p.lat ? (p.lat <= 1.0 ? p.lat : 0.5) : 0.5),
            lat: p.lat || null,
            lng: p.lng || null
        }));
        setPolygonPoints(mapped);
    } else {
        setPolygonPoints([]);
    }
    setMessage({ text: '', type: '' });
};

useEffect(() => {
    fetchMuseums();
    fetchObjects();

    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const galParam = params.get('gallery_id');
    if (tabParam) setActiveTab(tabParam);
    if (galParam) {
        setSelectedGalleryId(galParam);
    }
}, []);

const fetchGalleries = async (mId = selectedMuseumId) => {
    try {
        const params = mId ? { museum_id: mId } : {};
        const res = await getAdminGalleries(params);
        if (res.data) {
            setGalleries(res.data);
            const urlParams = new URLSearchParams(window.location.search);
            const galParam = urlParams.get('gallery_id');
            if (galParam) {
                selectGalleryById(galParam, res.data);
            }
        }
    } catch (err) { console.log('Failed to load galleries', err); }
};

const fetchMuseums = async () => {
    try {
        const res = await getMuseums();
        if (res.data) {
            setMuseums(res.data);
            if (res.data.length > 0) {
                const firstId = res.data[0].id;
                setSelectedMuseumId(firstId);
                fetchFloorPlans(firstId);
                fetchGalleries(firstId);
                fetchObjects(firstId);
                fetchEdges(null, firstId);
            }
        }
    } catch (err) { console.log('Failed to load museums:', err); }
};

const fetchEdges = async (floorPlanId, museumId) => {
    const fpId = floorPlanId || activeFloorPlan?.id || null;
    const mid = museumId || selectedMuseumId || null;
    try { 
        const res = await getEdges(mid ? parseInt(mid) : undefined, fpId || undefined);
        if (res.data) setEdges(res.data);
    } catch (err) { console.log(err); }
};

const fetchNodes = async (floorPlanId, museumId) => {
    const fpId = floorPlanId || activeFloorPlan?.id || null;
    const mid = museumId || selectedMuseumId || null;
    try { 
        const res = await getNodes(fpId || undefined, undefined, fpId ? undefined : (mid ? parseInt(mid) : undefined));
        if (res.data) setNodes(res.data);
    } catch (err) { setMessage({ text: 'Failed to load nodes', type: 'error' }); }
};

const handleNodeChange = (e) => {
    const id = e.target.value;
    setSelectedNodeId(id);
    setIsEditingNodeGps(false);
    const node = nodes.find(n => n.id === id);
    if (node) {
        setNodeX(node.x_coordinate);
        setNodeY(node.y_coordinate);
        if (node.latitude != null && node.longitude != null) {
            setLat(node.latitude.toString());
            setLng(node.longitude.toString());
            setOriginalCoords({ lat: node.latitude, lng: node.longitude });
        } else { setLat(''); setLng(''); setOriginalCoords(null); }
        setTargetRoomId(node.room_id || node.roomId || '');
        setSelectedObjectId(node.object_id ? node.object_id.toString() : '');
        setSelectedArtifactId(node.artifact_id || '');
    } else { 
        setLat(''); setLng(''); setNodeX(null); setNodeY(null); setOriginalCoords(null); setTargetRoomId('');
        setSelectedObjectId(''); setSelectedArtifactId('');
    }
    setMessage({ text: '', type: '' });
};

const handleMuseumChange = (e) => {
    const id = e.target.value;
    setSelectedMuseumId(id);
    setSelectedGalleryId('');
    setSelectedRoomId('');
    setPolygonPoints([]);
    setNodes([]);
    setEdges([]);
    setSelectedFloorPlanId('');
    setSelectedNodeId('');
    setLat(''); setLng(''); setNodeX(null); setNodeY(null);
    fetchFloorPlans(id);
    fetchGalleries(id);
    fetchEdges(null, id);
    fetchObjects(id);
};

const handleCanvasClick = (e) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, clickX / rect.width));
    const normY = Math.max(0, Math.min(1, clickY / rect.height));

    const gps = mapXyToGps(normX, normY, activeFloorPlan, activeMuseum);

    if (activeTab === 'coordinates') {
        if (!selectedNodeId) {
            setMessage({ text: 'Select a node first before clicking to place a pin.', type: 'error' });
            return;
        }
        setNodeX(normX);
        setNodeY(normY);
        if (isGeoreferenced && !isEditingNodeGps) {
            if (gps.lat != null && gps.lng != null) {
                setLat(gps.lat.toFixed(6));
                setLng(gps.lng.toFixed(6));
                setMessage({ text: `Position updated to (${(normX * 100).toFixed(1)}%, ${(normY * 100).toFixed(1)}%) — Lat: ${gps.lat.toFixed(6)}, Lng: ${gps.lng.toFixed(6)}`, type: 'success' });
            }
        } else {
            setMessage({ text: `Position updated to (${(normX * 100).toFixed(1)}%, ${(normY * 100).toFixed(1)}%)`, type: 'success' });
        }
    } else if (activeTab === 'boundaries') {
        if (doorwayMode) {
            const activeRoom = rooms.find(r => r.id === selectedRoomId);
            if (!activeRoom || !activeRoom.boundaries || activeRoom.boundaries.length < 3) {
                setMessage({ text: 'Please select a room with a saved boundary polygon in Step 1 first.', type: 'error' });
                return;
            }
            const snapInfo = findWallSnapAndAdjacentRoom(normX, normY, activeRoom, rooms);
            const snapGps = mapXyToGps(snapInfo.snapX, snapInfo.snapY, activeFloorPlan, activeMuseum);
            setPendingDoorway({
                snapX: snapInfo.snapX,
                snapY: snapInfo.snapY,
                p1: snapInfo.p1,
                p2: snapInfo.p2,
                adjacentRoom: snapInfo.adjacentRoom,
                gps: snapGps
            });
            setConnectedRoomId(snapInfo.adjacentRoom ? snapInfo.adjacentRoom.id : '');
            const adjLabel = snapInfo.adjacentRoom ? snapInfo.adjacentRoom.name : 'Entrance';
            setDoorwayName(`${activeRoom.name} ↔ ${adjLabel}`);
            setCreateEntranceNode(true);
            setDoorwayModalOpen(true);
            return;
        }

        setPolygonPoints(prev => [...prev, {
            x: normX,
            y: normY,
            lat: gps.lat,
            lng: gps.lng
        }]);
        setMessage({ text: '', type: '' });
    } else if (activeTab === 'footprint') {
        setFootprintPoints(prev => [...prev, {
            x: normX,
            y: normY,
            lat: gps.lat,
            lng: gps.lng
        }]);
        setMessage({ text: '', type: '' });
    } else if (activeTab === 'create') {
        setNodeX(normX);
        setNodeY(normY);
        if (gps.lat != null && gps.lng != null) {
            setLat(gps.lat.toFixed(6));
            setLng(gps.lng.toFixed(6));
        }
        setMessage({ text: `Selected position: (${(normX * 100).toFixed(1)}%, ${(normY * 100).toFixed(1)}%)`, type: 'success' });
    } else if (activeTab === 'wifi-survey') {
        setSurveyClickCoord({ x: normX, y: normY });
        setMessage({
            text: `Selected survey point at (${(normX * 100).toFixed(1)}%, ${(normY * 100).toFixed(1)}%). To record live hardware WiFi RSS signatures on-site, use the mobile app on Android.`,
            type: 'info'
        });
    }
};

const handleGalleryChange = (e) => {
    const id = e.target.value;
    if (id.startsWith('room:')) {
        const roomId = id.slice(5);
        const room = rooms.find(r => r.id.toString() === roomId);
        setSelectedRoomId(roomId);
        setSelectedGalleryId('');
        setPolygonPoints((room?.boundaries || []).map(p => ({
            x: p.x,
            y: p.y,
            lat: p.latitude ?? p.lat ?? null,
            lng: p.longitude ?? p.lng ?? null
        })));
        setMessage({ text: '', type: '' });
        return;
    }
    if (id) {
        setSelectedRoomId('');
        selectGalleryById(id);
    } else {
        setSelectedRoomId('');
        setSelectedGalleryId('');
        setPolygonPoints([]);
        setMessage({ text: '', type: '' });
    }
};

const handleSaveCoords = async () => {
    if (!selectedNodeId || nodeX == null || nodeY == null) return;

    let parsedLat = (lat !== '' && lat != null && !isNaN(parseFloat(lat))) ? parseFloat(lat) : null;
    let parsedLng = (lng !== '' && lng != null && !isNaN(parseFloat(lng))) ? parseFloat(lng) : null;

    if (parsedLat != null && (parsedLat < -90 || parsedLat > 90)) {
        setMessage({ text: 'Please enter a valid Latitude (-90 to 90).', type: 'error' });
        return;
    }
    if (parsedLng != null && (parsedLng < -180 || parsedLng > 180)) {
        setMessage({ text: 'Please enter a valid Longitude (-180 to 180).', type: 'error' });
        return;
    }

    // If only one coordinate is set, clear both for indoor-only placement
    if ((parsedLat != null && parsedLng == null) || (parsedLat == null && parsedLng != null)) {
        parsedLat = null;
        parsedLng = null;
    }

    // Footprint containment check
    if (footprintPoints && footprintPoints.length >= 3) {
        let checkX = nodeX;
        let checkY = nodeY;
        if (isGeoreferenced && isEditingNodeGps && parsedLat != null && parsedLng != null && activeFloorPlan) {
            const conv = gpsToMapXy(parsedLat, parsedLng, activeFloorPlan);
            if (conv.x != null && conv.y != null) {
                checkX = conv.x;
                checkY = conv.y;
            }
        }
        const isInsideFootprint = isPointInsidePolygon(checkX, checkY, footprintPoints);
        if (!isInsideFootprint) {
            setMessage({ text: 'Node position is outside the museum building boundary — check placement or footprint accuracy.', type: 'error' });
            return;
        }
    }

    // Room boundary containment check
    let assignedRoom = rooms.find(r => r.id === targetRoomId);
    if (!assignedRoom && containingRooms.length === 1) {
        assignedRoom = containingRooms[0];
    }
    if (!assignedRoom && selectedNode) {
        assignedRoom = rooms.find(r => r.id === selectedNode.room_id || (selectedNode.name && selectedNode.name.toLowerCase().includes(r.name.toLowerCase())));
    }

    if (assignedRoom && assignedRoom.boundaries && assignedRoom.boundaries.length >= 3) {
        const isInsideRoom = isPointInsidePolygon(nodeX, nodeY, assignedRoom.boundaries);
        if (!isInsideRoom) {
            setMessage({ text: `Position falls outside the ${assignedRoom.name} boundary — check placement.`, type: 'error' });
            return;
        }
    }

    setLoading(true);
    try {
        const hasGps = parsedLat != null && parsedLng != null;
        const payload = {
            x_coordinate: nodeX,
            y_coordinate: nodeY,
            latitude: parsedLat,
            longitude: parsedLng,
            is_manually_corrected: hasGps ? (!isGeoreferenced || isEditingNodeGps || Boolean(selectedNode?.is_manually_corrected)) : false,
            room_id: targetRoomId || assignedRoom?.id || null
        };
        await patchNodeCoordinates(selectedNodeId, payload);
        setMessage({
            text: hasGps
                ? `Node position & GPS saved successfully! ${!isGeoreferenced || isEditingNodeGps ? '(Locked manual GPS)' : ''}`
                : `Node floor plan position saved successfully! (Indoor mode without GPS)`,
            type: 'success'
        });
        setIsEditingNodeGps(false);
        await fetchNodes();
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to update coordinates'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleCreateEdgeSubmit = async (e) => {
    e.preventDefault();
    if (!edgeNodeA || !edgeNodeB) { setMessage({ text: 'Select both nodes.', type: 'error' }); return; }
    if (edgeNodeA === edgeNodeB) { setMessage({ text: 'Cannot connect a node to itself.', type: 'error' }); return; }
    if (currentConnectionStatus?.blocked) {
        setMessage({
            text: currentConnectionStatus.reason || `Blocked: Edge crosses wall of ${currentConnectionStatus.roomName || 'Room'}. Connect via an Entrance node instead.`,
            type: 'error'
        });
        return;
    }
    if (edges.find(ed => (ed.from_node_id === edgeNodeA && ed.to_node_id === edgeNodeB) || (ed.from_node_id === edgeNodeB && ed.to_node_id === edgeNodeA))) {
        setMessage({ text: 'Edge already exists.', type: 'error' }); return;
    }
    setLoading(true);
    try {
        await createEdge({ from_node_id: edgeNodeA, to_node_id: edgeNodeB, walkable: true, edge_type: edgeType });
        setMessage({ text: 'Edge created! Haversine distance auto-computed.', type: 'success' });
        await fetchEdges(); setEdgeNodeB('');
    } catch (err) { setMessage({ text: extractErrorMessage(err, 'Failed to create edge'), type: 'error' }); }
    finally { setLoading(false); }
};

const handleDeleteEdge = async (edgeId) => {
    if (!window.confirm('Delete this edge?')) return;
    try { await deleteEdge(edgeId); setMessage({ text: 'Edge deleted.', type: 'success' }); await fetchEdges(); }
    catch (err) { setMessage({ text: extractErrorMessage(err, 'Failed to delete edge.'), type: 'error' }); }
};

const handleCreateNodeSubmit = async (e) => {
    e.preventDefault();
    if (nodeX === null || nodeY === null) {
        setMessage({ text: 'Please click on the floor plan map to choose the node location first.', type: 'error' });
        return;
    }
    const isExhibit = newNodeType.includes('exhibit') || newNodeType.includes('artifact');
    if (isExhibit && !selectedArtifactId && !selectedObjectId) {
        setMessage({ text: 'Exhibit stops must be linked to an object or artifact. Please choose a registered museum object or artifact.', type: 'error' });
        return;
    }

    setLoading(true);
    try {
        let floor_plan_id = activeFloorPlan?.id || null;
        let artifactIdToUse = selectedArtifactId;

        // If an existing object is selected but no artifact record exists yet on this floor plan, auto-link/create it
        if (isExhibit && selectedObjectId && !artifactIdToUse && activeFloorPlan?.id) {
            const selectedObj = objects.find(o => o.id.toString() === selectedObjectId.toString());
            const matchingArt = artifacts.find(a => a.name?.toLowerCase() === selectedObj?.name?.toLowerCase());
            if (matchingArt) {
                artifactIdToUse = matchingArt.id;
            } else if (selectedObj) {
                try {
                    const artRes = await createArtifact({
                        floor_plan_id: activeFloorPlan.id,
                        name: selectedObj.name,
                        description: selectedObj.description || null,
                        map_x: nodeX ?? 0.5,
                        map_y: nodeY ?? 0.5,
                        latitude: lat ? parseFloat(lat) : (selectedObj.latitude || null),
                        longitude: lng ? parseFloat(lng) : (selectedObj.longitude || null),
                    });
                    if (artRes?.data?.id) {
                        artifactIdToUse = artRes.data.id;
                        await fetchArtifacts(activeFloorPlan.id);
                    }
                } catch (artErr) {
                    console.warn("Could not auto-create artifact on floor plan, delegating to backend:", artErr);
                }
            }
        }

        await createNode({
            name: newNodeName,
            floor: Number(newNodeFloor),
            node_type: newNodeType,
            x: nodeX,
            y: nodeY,
            floor_plan_id,
            latitude: lat ? parseFloat(lat) : null,
            longitude: lng ? parseFloat(lng) : null,
            artifact_id: isExhibit ? artifactIdToUse : null,
            object_id: isExhibit && selectedObjectId ? parseInt(selectedObjectId) : null
        });
        setMessage({ text: `Node "${newNodeName}" created successfully!`, type: 'success' });
        setNewNodeName('');
        setSelectedArtifactId('');
        setSelectedObjectId('');
        setNodeX(null);
        setNodeY(null);
        setLat('');
        setLng('');
        await fetchNodes();
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to create node'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleCreateArtifactSubmit = async (e) => {
    e?.preventDefault();
    if (!activeFloorPlan?.id) {
        setMessage({ text: 'Select a floor plan before creating an object/artifact.', type: 'error' });
        return;
    }
    if (!newArtifactForm.name.trim()) {
        setMessage({ text: 'Object / Artifact name is required.', type: 'error' });
        return;
    }
    setIsCreatingArtifact(true);
    try {
        const targetMuseumId = activeFloorPlan?.museum_id || selectedMuseumId || (museums.length > 0 ? museums[0].id : null);
        let createdObjId = null;

        // 1. Create in objects table (Museum Objects Catalog)
        if (targetMuseumId) {
            try {
                const objRes = await createAdminObject({
                    name: newArtifactForm.name.trim(),
                    description: newArtifactForm.description.trim() || null,
                    museum_id: parseInt(targetMuseumId),
                    gallery_id: selectedGalleryId ? parseInt(selectedGalleryId) : null,
                    category: newArtifactForm.category?.trim() || 'Exhibit',
                    latitude: lat ? parseFloat(lat) : null,
                    longitude: lng ? parseFloat(lng) : null,
                });
                const objData = objRes?.data || objRes;
                createdObjId = objData?.id || null;
            } catch (objErr) {
                console.warn("Could not create in admin objects API directly, mapping service will auto-sync:", objErr);
            }
        }

        // 2. Create in artifacts table (Floor Plan)
        const res = await createArtifact({
            floor_plan_id: activeFloorPlan.id,
            name: newArtifactForm.name.trim(),
            description: newArtifactForm.description.trim() || null,
            map_x: nodeX ?? 0.5,
            map_y: nodeY ?? 0.5,
            latitude: lat ? parseFloat(lat) : null,
            longitude: lng ? parseFloat(lng) : null,
        });
        const created = res?.data || res;

        await fetchArtifacts(activeFloorPlan.id);
        await fetchObjects(targetMuseumId);

        if (created?.id) setSelectedArtifactId(created.id);
        if (createdObjId) {
            setSelectedObjectId(createdObjId.toString());
        } else {
            const refreshedRes = await getAdminObjects({ museum_id: targetMuseumId }).catch(() => null);
            const matching = (refreshedRes?.data || []).find(o => o.name?.toLowerCase() === created?.name?.toLowerCase());
            if (matching) {
                setSelectedObjectId(matching.id.toString());
            }
        }

        if (!newNodeName && created?.name) {
            setNewNodeName(created.name);
        }
        setMessage({ text: `Object "${created?.name || newArtifactForm.name}" created and synced to both museum catalog and floor plan!`, type: 'success' });
        setShowNewArtifactModal(false);
        setNewArtifactForm({ name: '', description: '', category: 'Exhibit' });
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to create object/artifact'), type: 'error' });
    } finally {
        setIsCreatingArtifact(false);
    }
};

const handleAssignQr = async (nodeId, payloadToAssign) => {
    if (!activeFloorPlan?.id || !nodeId) return;
    const finalPayload = (payloadToAssign || qrPayloadInput).trim();
    if (!finalPayload) {
        setMessage({ text: 'Please specify a QR payload code.', type: 'error' });
        return;
    }
    setLoading(true);
    try {
        await createQrLocation({
            floor_plan_id: activeFloorPlan.id,
            node_id: nodeId,
            qr_payload: finalPayload
        });
        setMessage({ text: `QR checkpoint assigned: ${finalPayload}`, type: 'success' });
        await fetchQrs();
        setQrPayloadInput('');
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to assign QR checkpoint'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleDeleteNodeSubmit = async (nodeId) => {
    if (!window.confirm('Are you sure you want to delete this node?')) return;
    setLoading(true);
    try {
        await deleteNode(nodeId);
        setMessage({ text: 'Node deleted successfully.', type: 'success' });
        if (selectedNodeId === nodeId) {
            setSelectedNodeId('');
            setLat(''); setLng(''); setNodeX(null); setNodeY(null);
        }
        await fetchNodes();
        await fetchEdges();
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to delete node'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleSaveBoundary = async () => {
    if (polygonPoints.length < 3) {
        setMessage({ text: 'A room boundary must have at least 3 corner points.', type: 'error' });
        return;
    }
    setLoading(true);
    try {
        const sortedPoints = getSortedPolygonPoints(polygonPoints);
        const cleanPoints = sortedPoints.map(p => ({
            x: p.x,
            y: p.y,
            lat: p.lat,
            lng: p.lng
        }));

        if (activeFloorPlan) {
            const selectedRoom = rooms.find(r => r.id.toString() === selectedRoomId?.toString());
            const selectedGal = galleries.find(g => g.id.toString() === selectedGalleryId?.toString());
            const targetName = selectedRoom?.name || (selectedGal ? selectedGal.name : (newRoomName || 'Room Boundary'));
            const existingRoom = rooms.find(r => r.name.toLowerCase() === targetName.toLowerCase());

            if (existingRoom) {
                await updateRoom(existingRoom.id, {
                    name: targetName,
                    room_type: newRoomType || existingRoom.room_type || 'gallery',
                    walkable: newRoomWalkable,
                    boundaries: cleanPoints
                });
            } else {
                await createRoom({
                    floor_plan_id: activeFloorPlan.id,
                    name: targetName,
                    room_type: newRoomType || 'gallery',
                    walkable: newRoomWalkable,
                    boundaries: cleanPoints
                });
            }
        }

        if (selectedGalleryId) {
            try {
                await updateAdminGallery(selectedGalleryId, {
                    boundary_polygon: cleanPoints.map(p => ({ lat: p.lat, lng: p.lng, x: p.x, y: p.y }))
                });
            } catch (gErr) {
                console.warn('Could not sync boundary polygon to main gallery record:', gErr);
            }
        }

        setMessage({ text: 'Room boundary polygon saved successfully!', type: 'success' });
        setPolygonPoints([]);
        if (activeFloorPlan) fetchRoomsForFloorPlan(activeFloorPlan.id);
        fetchGalleries(selectedMuseumId);
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to save boundary'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleConfirmSaveDoorway = async () => {
    if (!pendingDoorway || !selectedRoomId) return;
    setLoading(true);
    try {
        const { p1, p2, snapX, snapY, gps } = pendingDoorway;
        const activeRoom = rooms.find(r => r.id === selectedRoomId);
        const toRoom = rooms.find(r => r.id === connectedRoomId);
        const doorLabel = doorwayName.trim() || `${activeRoom?.name || 'Room'} ↔ ${toRoom?.name || 'Entrance'}`;

        await createDoorway({
            room_id: selectedRoomId,
            x1: p1.x,
            y1: p1.y,
            x2: p2.x,
            y2: p2.y,
            connected_room_id: connectedRoomId || null,
            name: doorLabel
        });

        if (createEntranceNode && activeFloorPlan) {
            try {
                await createNode({
                    name: `${doorLabel}`,
                    floor: Number(activeFloorPlan.floor_number || 1),
                    floor_plan_id: activeFloorPlan.id,
                    node_type: 'entrance',
                    x_coordinate: snapX,
                    y_coordinate: snapY,
                    latitude: gps?.lat || null,
                    longitude: gps?.lng || null
                });
                await fetchNodes(activeFloorPlan.id);
            } catch (nErr) {
                console.warn('Could not auto-create entrance node:', nErr);
            }
        }

        setMessage({
            text: `Doorway opening & Entrance connecting ${activeRoom?.name || 'Room'} to ${toRoom?.name || 'Entrance'} saved!`,
            type: 'success'
        });
        setDoorwayModalOpen(false);
        setPendingDoorway(null);
        setDoorwayMode(false);
        if (activeFloorPlan) fetchRoomsForFloorPlan(activeFloorPlan.id);
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to save doorway'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const handleDeleteDoorway = async (doorwayId) => {
    if (!window.confirm('Delete this doorway opening?')) return;
    setLoading(true);
    try {
        await deleteDoorway(doorwayId);
        setMessage({ text: 'Doorway opening deleted successfully.', type: 'success' });
        if (activeFloorPlan) fetchRoomsForFloorPlan(activeFloorPlan.id);
    } catch (err) {
        setMessage({ text: extractErrorMessage(err, 'Failed to delete doorway'), type: 'error' });
    } finally {
        setLoading(false);
    }
};

const selectedNode = nodes.find(n => n.id === selectedNodeId);
const allFloors = [...new Set(nodes.map(n => n.floor))].sort((a, b) => a - b);

const totalNodes = nodes.length;
const coordinated = nodes.filter(n => n.latitude).length;
const orphaned = nodes.filter(n => !edges.some(e => e.from_node_id === n.id || e.to_node_id === n.id)).length;

return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
        <div className="flex items-center mb-6 border-b pb-4">
            <MapPin className="w-8 h-8 text-indigo-600 mr-3" />
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Master Map & Graph Editor</h2>
                <p className="text-sm text-gray-500">Place nodes directly on the floor plan image, connect paths, and draw room boundaries.</p>
            </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-3 rounded-lg text-center"><div className="text-2xl font-bold text-blue-700">{coordinated}/{totalNodes}</div><div className="text-xs text-blue-600">Nodes Placed</div></div>
            <div className="bg-green-50 p-3 rounded-lg text-center"><div className="text-2xl font-bold text-green-700">{edges.length}</div><div className="text-xs text-green-600">Edges</div></div>
            <div className={`p-3 rounded-lg text-center ${orphaned > 0 ? 'bg-red-50' : 'bg-gray-50'}`}><div className={`text-2xl font-bold ${orphaned > 0 ? 'text-red-700' : 'text-gray-700'}`}>{orphaned}</div><div className={`text-xs ${orphaned > 0 ? 'text-red-600' : 'text-gray-600'}`}>Orphaned Nodes</div></div>
        </div>

        <div className="flex flex-wrap items-center justify-between border-b border-gray-200 mb-6 gap-2">
            <div className="flex flex-wrap items-center gap-1">
                <button onClick={() => setActiveTab('coordinates')} className={`py-2.5 px-4 font-bold text-sm rounded-t-lg transition-colors ${activeTab === 'coordinates' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-800'}`}>Node Coordinates</button>
                <button onClick={() => setActiveTab('edges')} className={`py-2.5 px-4 font-bold text-sm rounded-t-lg transition-colors ${activeTab === 'edges' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-800'}`}>Edge Connections</button>
                <button onClick={() => setActiveTab('boundaries')} className={`py-2.5 px-4 font-bold text-sm rounded-t-lg transition-colors ${activeTab === 'boundaries' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-800'}`}>Room Boundaries</button>
                <button onClick={() => setActiveTab('footprint')} className={`py-2.5 px-4 font-bold text-sm rounded-t-lg transition-colors ${activeTab === 'footprint' ? 'border-b-2 border-purple-600 text-purple-600 bg-purple-50/50' : 'text-gray-500 hover:text-gray-800'}`}>Building Footprint</button>
                <button onClick={() => setActiveTab('audit')} className={`py-2.5 px-4 font-bold text-sm rounded-t-lg transition-colors ${activeTab === 'audit' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-800'}`}>Node Audit Table</button>
                <button onClick={() => setActiveTab('create')} className={`py-2.5 px-4 font-bold text-sm rounded-t-lg transition-colors ${activeTab === 'create' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-800'}`}>+ Create Node</button>

            </div>
            <button 
                onClick={() => setShowPreview(!showPreview)}
                className={`py-2 px-4 font-bold text-sm rounded-lg transition-colors ${showPreview ? 'border-2 border-blue-600 text-blue-600 bg-blue-50' : 'border border-gray-300 text-gray-600 hover:bg-gray-100'}`}
                title="Toggle visitor-facing map preview"
            >
                👁️ Preview
            </button>
        </div>

        <div className="mb-6 bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            {/* Top Row: Selectors Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Museum Select */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Museum
                    </label>
                    <select
                        className="w-full p-2.5 text-sm font-medium text-slate-800 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs transition-all"
                        value={selectedMuseumId}
                        onChange={handleMuseumChange}
                    >
                        <option value="">-- Select Museum --</option>
                        {museums.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                {/* Floor Plan Select */}
                <div>
                    <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Floor Plan
                        </label>
                        <div className="flex items-center gap-2">
                            {activeFloorPlan && (
                                <button
                                    type="button"
                                    onClick={handleDeleteFloorPlan}
                                    className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-0.5 hover:underline cursor-pointer"
                                    title="Delete this floor plan level"
                                >
                                    <Trash2 className="w-3 h-3" /> Delete
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowNewFloorPlanModal(true)}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 hover:underline cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5" /> Add New
                            </button>
                        </div>
                    </div>
                    <select
                        className="w-full p-2.5 text-sm font-medium text-slate-800 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs transition-all"
                        value={selectedFloorPlanId}
                        onChange={e => setSelectedFloorPlanId(e.target.value)}
                    >
                        {floorPlans.length === 0 && <option value="">-- No floor plans --</option>}
                        {floorPlans.map(fp => (
                            <option key={fp.id} value={fp.id}>{fp.name} (Floor {fp.floor_number})</option>
                        ))}
                    </select>
                </div>

                {/* Filter by Floor Select */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Filter by Floor
                    </label>
                    <select
                        className="w-full p-2.5 text-sm font-medium text-slate-800 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs transition-all"
                        value={filterFloor}
                        onChange={e => setFilterFloor(e.target.value)}
                    >
                        <option value="">All Floors</option>
                        {allFloors.map(f => (
                            <option key={f} value={f}>Floor {f}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Bottom Row: Status Badges & Action Buttons */}
            <div className="pt-3 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Validation Status Badge */}
                    {invalidEdgeIds && invalidEdgeIds.length > 0 ? (
                        <button
                            type="button"
                            onClick={() => setShowValidationModal(true)}
                            className="px-3 py-1.5 bg-red-100 text-red-900 border border-red-300 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs hover:bg-red-200 cursor-pointer transition-all"
                        >
                            <AlertTriangle className="w-4 h-4 text-red-600" /> {invalidEdgeIds.length} Invalid Edge{invalidEdgeIds.length !== 1 ? 's' : ''} — Click to review
                        </button>
                    ) : outOfBoundaryNodeIds && outOfBoundaryNodeIds.length > 0 ? (
                        <button
                            type="button"
                            onClick={() => setShowValidationModal(true)}
                            className="px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs hover:bg-amber-200 cursor-pointer transition-all"
                        >
                            <AlertCircle className="w-4 h-4 text-amber-600" /> {outOfBoundaryNodeIds.length} Out-of-Boundary Node{outOfBoundaryNodeIds.length !== 1 ? 's' : ''} — Click to review
                        </button>
                    ) : lastValidationTime ? (
                        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs">
                            <CheckCircle className="w-4 h-4 text-emerald-600" /> Map validation passed ✓
                        </span>
                    ) : null}

                    {activeFloorPlan && (
                        isGeoreferenced ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs" title={`${verifiedReferencePointsCount} real-world reference points verified`}>
                                    <CheckCircle className="w-4 h-4 text-emerald-600" /> Georeferenced ✓ ({verifiedReferencePointsCount} points)
                                </span>
                                {calibrationDiscrepancy?.isWarning && (
                                    <span className="px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs animate-pulse" title={`Calibrated scale ${calibrationDiscrepancy.calibratedScale.toFixed(3)}m/px deviates by ${calibrationDiscrepancy.diffPercent.toFixed(1)}% from known scale ${calibrationDiscrepancy.knownScale.toFixed(3)}m/px`}>
                                        <AlertTriangle className="w-4 h-4 text-amber-600" /> Scale Discrepancy ({calibrationDiscrepancy.diffPercent.toFixed(0)}%)
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={handleGeoreferenceClear}
                                    className="px-2.5 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1"
                                    title="Remove all GPS coordinates and anchors from this floor plan"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Remove Lat/Lng
                                </button>
                            </div>
                        ) : verifiedReferencePointsCount === 1 ? (
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs" title="At least 2 real reference points required for affine transform calibration">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Needs calibration verification (1 of 2 points set)
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowGeoreferenceModal(true)}
                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 shadow-xs transition-all"
                                >
                                    + Add 2nd Reference Point
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-300 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Indoor Mode (X/Y)
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowGeoreferenceModal(true)}
                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold hover:bg-indigo-100 shadow-xs transition-all"
                                >
                                    + Add GPS (Optional)
                                </button>
                            </div>
                        )
                    )}

                    {footprintPoints && footprintPoints.length >= 3 ? (
                        <span className="px-3 py-1.5 bg-purple-100 text-purple-900 border border-purple-300 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs">
                            <CheckCircle className="w-4 h-4 text-purple-600" /> Building Boundary Set ✓
                        </span>
                    ) : (
                        <span className="px-3 py-1.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs">
                            <AlertCircle className="w-4 h-4 text-amber-600" /> No building boundary set
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleRecomputeLatLng}
                        disabled={loading || !activeFloorPlan}
                        className="px-3.5 py-1.5 bg-white border border-slate-300 text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Recompute Lat/Lng
                    </button>
                    <button
                        type="button"
                        onClick={handleValidatePaths}
                        disabled={loading || !activeFloorPlan}
                        className="px-3.5 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                        <ShieldAlert className="w-3.5 h-3.5" /> Validate Paths
                    </button>
                    <button
                        type="button"
                        onClick={handleValidateAll}
                        disabled={loading || !activeFloorPlan}
                        className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                        <ShieldAlert className="w-3.5 h-3.5" /> Validate All
                    </button>
                </div>
            </div>
        </div>

        {message.text && (
            <div className={`p-4 mb-6 rounded-lg flex items-center ${message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                <AlertCircle className="w-5 h-5 mr-2" />{message.text}
            </div>
        )}

        {activeTab === 'audit' ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><Table className="w-5 h-5 text-indigo-600" /> Node Coordinate Audit Table</h3>
                    <span className="text-xs font-medium text-gray-500">{nodes.length} total nodes ({nodes.filter(n => n.latitude != null).length} georeferenced)</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 text-gray-700 border-b font-bold text-xs uppercase">
                            <tr>
                                <th className="p-3 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('name')}>Node Name {sortCol === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                                <th className="p-3 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('floor')}>Floor {sortCol === 'floor' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                                <th className="p-3 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('node_type')}>Type {sortCol === 'node_type' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                                <th className="p-3">Position (X, Y)</th>
                                <th className="p-3 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('latitude')}>Latitude {sortCol === 'latitude' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                                <th className="p-3 cursor-pointer hover:bg-gray-200" onClick={() => handleSort('longitude')}>Longitude {sortCol === 'longitude' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</th>
                                <th className="p-3 text-center">Status</th>
                                <th className="p-3 text-center">Inside Boundary</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {sortedAuditNodes.map(n => (
                                <tr key={n.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-semibold text-gray-900">{n.name}</td>
                                    <td className="p-3 text-gray-600">Floor {n.floor}</td>
                                    <td className="p-3 text-gray-600"><span className="px-2 py-0.5 bg-gray-100 border rounded text-xs">{n.node_type}</span></td>
                                    <td className="p-3 text-gray-500 font-mono text-xs">{n.x_coordinate != null ? `${(n.x_coordinate <= 1.0 ? n.x_coordinate * 100 : n.x_coordinate).toFixed(1)}%, ${(n.y_coordinate <= 1.0 ? n.y_coordinate * 100 : n.y_coordinate).toFixed(1)}%` : '—'}</td>
                                    <td className="p-3 text-gray-800 font-mono text-xs">{n.latitude != null ? n.latitude.toFixed(6) : '—'}</td>
                                    <td className="p-3 text-gray-800 font-mono text-xs">{n.longitude != null ? n.longitude.toFixed(6) : '—'}</td>
                                    <td className="p-3 text-center">
                                        {n.latitude != null ? (
                                            <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Georeferenced</span>
                                        ) : (
                                            <span className="inline-flex items-center text-xs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-full"><AlertCircle className="w-3.5 h-3.5 mr-1 text-amber-600" /> Unset</span>
                                        )}
                                    </td>
                                    <td className="p-3 text-center">
                                        {footprintPoints.length < 3 ? (
                                            <span className="text-gray-400 text-xs font-mono">N/A</span>
                                        ) : isPointInsidePolygon(n.x_coordinate, n.y_coordinate, footprintPoints) ? (
                                            <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">✓ Inside</span>
                                        ) : (
                                            <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">✗ Outside</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="space-y-6">
                    {activeTab === 'coordinates' ? (
                        <>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className="block text-sm font-bold text-gray-700 mb-2">1. Select Node to Place</label>
                                <select value={selectedNodeId} onChange={handleNodeChange} className="w-full border-gray-300 rounded-lg p-3 bg-white border">
                                    <option value="">-- Choose a node --</option>
                                    {nodes.map(n => (
                                        <option key={n.id} value={n.id}>{n.name} (Floor {n.floor}) {n.latitude ? '✓' : '✗'}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedNode && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-4 shadow-sm">
                                    <div className="flex justify-between items-center border-b pb-3">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900">{selectedNode.name}</h3>
                                            <p className="text-xs text-gray-500">Floor {selectedNode.floor} · {selectedNode.node_type}</p>
                                        </div>
                                        <button onClick={() => handleDeleteNodeSubmit(selectedNode.id)} className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 border border-red-200 rounded hover:bg-red-50">
                                            <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Delete
                                        </button>
                                    </div>

                                    {/* Room Containment Status & Picker */}
                                    {nodeX != null && nodeY != null && (
                                        <div>
                                            {containingRooms.length === 1 ? (
                                                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5">
                                                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                                    <span>Inside <strong>{containingRooms[0].name}</strong> boundary</span>
                                                </div>
                                            ) : containingRooms.length > 1 ? (
                                                <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3 rounded-lg text-xs space-y-2">
                                                    <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                                        <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                                        <span>Point is inside multiple rooms — select the correct one:</span>
                                                    </div>
                                                    <select
                                                        value={targetRoomId}
                                                        onChange={e => setTargetRoomId(e.target.value)}
                                                        className="w-full bg-white border border-amber-300 rounded-md p-2 text-xs font-bold text-gray-800"
                                                    >
                                                        <option value="">-- Select containing room --</option>
                                                        {containingRooms.map(r => (
                                                            <option key={r.id} value={r.id}>{r.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : rooms.length > 0 ? (
                                                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-xs flex items-center gap-1.5">
                                                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                                    <span>Position is outside all defined room boundaries on this floor.</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}

                                    <div className="bg-indigo-50 p-3 rounded-lg text-xs text-indigo-800 flex items-start gap-2 border border-indigo-200">
                                        <MousePointerClick className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <strong>Click on the floor plan</strong> image on the right to select this node's position. X/Y coordinates and{isGeoreferenced ? ' GPS' : ''} will be populated automatically{isGeoreferenced ? ' via georeferencing' : '. Enter GPS manually if georeferenced'}.
                                            {showPreview && <div className="text-[11px] mt-1 opacity-75">👁️ Preview mode active — changes appear in real-time below.</div>}
                                        </div>
                                    </div>

                                    {/* Lat/Lng Section: Ungeoreferenced vs Georeferenced */}
                                    {!isGeoreferenced ? (
                                        <div className="space-y-3 bg-amber-50/70 p-3 rounded-xl border border-amber-200">
                                            <div className="flex items-center justify-between text-xs text-amber-900 font-bold">
                                                <span>GPS Coordinates (Manual Entry)</span>
                                                <button
                                                    type="button"
                                                    onClick={handleUseGPSForPoint}
                                                    className="text-[10px] bg-amber-700 hover:bg-amber-800 text-white font-bold px-2 py-1 rounded flex items-center gap-1 shadow-xs"
                                                >
                                                    <Navigation className="w-3 h-3" /> Use My GPS
                                                </button>
                                            </div>
                                            <p className="text-[11px] text-amber-800 leading-tight">
                                                No georeferencing set — enter GPS coordinates manually.
                                            </p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Latitude</label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={lat}
                                                        onChange={e => setLat(e.target.value)}
                                                        placeholder="e.g. 13.0721"
                                                        className="w-full border-gray-300 rounded-md p-2 bg-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 border"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-700 mb-1">Longitude</label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={lng}
                                                        onChange={e => setLng(e.target.value)}
                                                        placeholder="e.g. 77.6550"
                                                        className="w-full border-gray-300 rounded-md p-2 bg-white text-sm font-mono focus:ring-2 focus:ring-indigo-500 border"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-gray-700">GPS Coordinates</span>
                                                    <span className="text-[10px] text-gray-400 font-normal">(Optional)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {(lat || lng) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setLat(''); setLng(''); }}
                                                            className="text-[11px] font-semibold text-amber-600 hover:text-amber-800 underline"
                                                        >
                                                            Clear GPS (Use X/Y only)
                                                        </button>
                                                    )}
                                                    {!isEditingNodeGps ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsEditingNodeGps(true)}
                                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                        >
                                                            <Edit3 className="w-3 h-3" /> Edit precise location
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsEditingNodeGps(false)}
                                                            className="text-xs font-bold text-gray-500 hover:text-gray-700"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {(!lat && !lng) && (
                                                <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5 font-medium">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                                    <span>Floor Plan Mode (Indoor X/Y only) — GPS lat/long not required</span>
                                                </div>
                                            )}

                                            {isEditingNodeGps && (
                                                <div className="flex items-center justify-between pt-1">
                                                    <span className="text-[11px] text-gray-500">Fine-tune real-world GPS coordinates:</span>
                                                    <button
                                                        type="button"
                                                        onClick={handleUseGPSForPoint}
                                                        className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 hover:bg-indigo-700"
                                                    >
                                                        <Navigation className="w-3 h-3" /> Use My GPS
                                                    </button>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Latitude</label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={lat}
                                                        onChange={e => setLat(e.target.value)}
                                                        readOnly={!isEditingNodeGps}
                                                        placeholder="Optional (Auto / Blank)"
                                                        className={`w-full border rounded-md p-2 text-sm font-mono ${isEditingNodeGps ? 'bg-white border-indigo-300 focus:ring-2 focus:ring-indigo-500' : 'bg-gray-100 border-gray-200 text-gray-600'}`}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 mb-1">Longitude</label>
                                                    <input
                                                        type="number"
                                                        step="any"
                                                        value={lng}
                                                        onChange={e => setLng(e.target.value)}
                                                        readOnly={!isEditingNodeGps}
                                                        placeholder="Optional (Auto / Blank)"
                                                        className={`w-full border rounded-md p-2 text-sm font-mono ${isEditingNodeGps ? 'bg-white border-indigo-300 focus:ring-2 focus:ring-indigo-500' : 'bg-gray-100 border-gray-200 text-gray-600'}`}
                                                    />
                                                </div>
                                            </div>
                                            {lat && lng && (() => {
                                                const ref = computeReferenceDistances(lat, lng, selectedNode?.id);
                                                if (!ref || (!ref.nearestNodeDist && !ref.nearestAnchorDist)) return null;
                                                return (
                                                    <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex flex-wrap items-center gap-1.5 font-mono">
                                                        <span className="font-semibold text-emerald-900">📏 Real distance (Haversine):</span>
                                                        {ref.nearestNodeDist && <span>{ref.nearestNodeDist}m to nearest node ({ref.nearestNodeName})</span>}
                                                        {ref.nearestNodeDist && ref.nearestAnchorDist && <span>·</span>}
                                                        {ref.nearestAnchorDist && <span>{ref.nearestAnchorDist}m to {ref.nearestAnchorName}</span>}
                                                    </div>
                                                );
                                            })()}

                                            {(selectedNode.is_manually_corrected || isEditingNodeGps) && (lat || lng) && (
                                                <div className="text-[10px] text-purple-700 bg-purple-50 p-2 rounded border border-purple-200 flex items-center gap-1 font-medium">
                                                    ★ Manually corrected coordinates — locked from recalibration.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Linked Exhibit Artifact / Object Info */}
                                    {(selectedNode.node_type?.includes('exhibit') || selectedNode.node_type?.includes('artifact') || selectedNode.artifact_id || selectedNode.object_id) && (
                                        <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-xl space-y-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 uppercase tracking-wider">
                                                    <Package className="w-4 h-4 text-indigo-600" />
                                                    <span>Linked Museum Object</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewArtifactModal(true)}
                                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                                                >
                                                    <Plus className="w-3 h-3" /> New Object
                                                </button>
                                            </div>
                                            {selectedNode.object_id ? (
                                                (() => {
                                                    const obj = objects.find(o => o.id === selectedNode.object_id);
                                                    return (
                                                        <div className="text-xs text-slate-800 pt-1 space-y-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-bold text-slate-900">{obj?.name || `Object #${selectedNode.object_id}`}</p>
                                                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-1.5 py-0.2 rounded">Catalog #{selectedNode.object_id}</span>
                                                            </div>
                                                            {obj?.category && <p className="text-indigo-600 text-[11px] font-medium">{obj.category}</p>}
                                                            {obj?.description && <p className="text-slate-500 text-[11px] line-clamp-2">{obj.description}</p>}
                                                        </div>
                                                    );
                                                })()
                                            ) : selectedNode.artifact_id ? (
                                                (() => {
                                                    const art = artifacts.find(a => a.id === selectedNode.artifact_id);
                                                    return (
                                                        <div className="text-xs text-slate-800 pt-1">
                                                            <p className="font-bold text-slate-900">{art?.name || 'Artifact ID: ' + selectedNode.artifact_id}</p>
                                                            {art?.description && <p className="text-slate-500 text-[11px] mt-0.5">{art.description}</p>}
                                                        </div>
                                                    );
                                                })()
                                            ) : (
                                                <div className="text-xs text-amber-800 font-medium pt-1">
                                                    <span>No object/artifact linked yet.</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* QR Checkpoint Management */}
                                    {(() => {
                                        const assignedQr = qrLocations.find(q => q.node_id === selectedNode.id);
                                        return (
                                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                                                        <QrCode className="w-4 h-4 text-slate-700" />
                                                        <span>QR Checkpoint</span>
                                                    </div>
                                                    {assignedQr && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setActiveQrForModal(assignedQr);
                                                                setShowQrModal(true);
                                                            }}
                                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" /> View / Print
                                                        </button>
                                                    )}
                                                </div>
                                                {assignedQr ? (
                                                    <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg">
                                                        <span className="font-mono text-xs font-bold text-slate-800">{assignedQr.qr_payload}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setActiveQrForModal(assignedQr);
                                                                setShowQrModal(true);
                                                            }}
                                                            className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-bold hover:bg-indigo-100"
                                                        >
                                                            Print QR
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-1.5">
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={qrPayloadInput}
                                                                onChange={e => setQrPayloadInput(e.target.value)}
                                                                placeholder={`e.g. DIGITAL_MUSEUM_${selectedNode.name.toUpperCase().replace(/\s+/g, '_')}`}
                                                                className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono bg-white"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAssignQr(selectedNode.id)}
                                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all"
                                                            >
                                                                Assign QR
                                                            </button>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500">Visitors scan this QR code to calibrate indoor position on entrance.</p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    <button onClick={handleSaveCoords} disabled={loading || nodeX == null} className={`w-full flex items-center justify-center px-6 py-3 rounded-xl text-white font-bold shadow-md transition-all ${loading || nodeX == null ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                        <Save className="w-5 h-5 mr-2" />{loading ? 'Saving...' : 'Save Position'}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : activeTab === 'edges' ? (
                        <>
                            <form onSubmit={handleCreateEdgeSubmit} className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
                                <h3 className="font-bold text-gray-800 flex items-center"><Link2 className="w-5 h-5 mr-2 text-indigo-600" /> Connect Two Nodes</h3>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">From Node (A)</label>
                                    <select value={edgeNodeA} onChange={e => setEdgeNodeA(e.target.value)} className="w-full border-gray-300 rounded-lg p-2.5 bg-white border text-sm">
                                        <option value="">-- Select Node A --</option>
                                        {nodes.map(n => {
                                            const r = getNodeRoom(n);
                                            const isEnt = isEntranceNode(n);
                                            return (
                                                <option key={n.id} value={n.id}>
                                                    {n.name} {r ? `[${r.name}]` : ''} {isEnt ? '🚪 (Entrance)' : ''} (Floor {n.floor})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">To Node (B)</label>
                                    <select value={edgeNodeB} onChange={e => setEdgeNodeB(e.target.value)} className="w-full border-gray-300 rounded-lg p-2.5 bg-white border text-sm">
                                        <option value="">-- Select Node B --</option>
                                        {nodes.filter(n => n.id !== edgeNodeA).map(n => {
                                            const r = getNodeRoom(n);
                                            const isEnt = isEntranceNode(n);
                                            const chk = nodeA ? checkWallCrossing(nodeA, n) : null;
                                            const prefix = chk ? (chk.blocked ? '⛔ Wall Blocked — ' : '✓ Valid — ') : '';
                                            return (
                                                <option key={n.id} value={n.id}>
                                                    {prefix}{n.name} {r ? `[${r.name}]` : ''} {isEnt ? '🚪 (Entrance Guide)' : ''} (Floor {n.floor})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Edge Type</label>
                                    <select value={edgeType} onChange={e => setEdgeType(e.target.value)} className="w-full border-gray-300 rounded-lg p-2.5 bg-white border text-sm">
                                        <option value="normal">Normal Walkway</option>
                                        <option value="stairs">Stairs</option>
                                        <option value="elevator">Elevator</option>
                                        <option value="escalator">Escalator</option>
                                    </select>
                                </div>

                                {/* Live Connection Guidance */}
                                {nodeA && (
                                    <div className="rounded-xl border p-3 text-xs transition-all animate-fadeIn">
                                        {nodeB ? (
                                            currentConnectionStatus?.blocked ? (
                                                <div className="bg-red-50 border border-red-200 text-red-800 p-2.5 rounded-lg space-y-1">
                                                    <div className="font-bold flex items-center gap-1.5 text-red-700">
                                                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                                                        <span>Wall Blocked ({currentConnectionStatus.roomName || 'Room'})</span>
                                                    </div>
                                                    <p className="text-[11px] leading-relaxed text-red-700/90">
                                                        {currentConnectionStatus.reason || 'This direct line crosses a room wall. Rooms can only be entered or exited through an Entrance node.'}
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="bg-slate-50 border border-slate-200 text-slate-700 p-2.5 rounded-lg space-y-1">
                                                    <div className="font-bold flex items-center gap-1.5 text-slate-800">
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                        <span>Valid Pathway Connection</span>
                                                    </div>
                                                    <p className="text-[11px] leading-relaxed text-slate-600">
                                                        This path respects room walls and connects cleanly.
                                                    </p>
                                                </div>
                                            )
                                        ) : (
                                            <div className="bg-slate-50 border border-slate-200 text-slate-700 p-2.5 rounded-lg space-y-1">
                                                <div className="font-bold flex items-center gap-1.5 text-slate-800">
                                                    <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                                                    <span>Select Second Node (Node B)</span>
                                                </div>
                                                <p className="text-[11px] leading-relaxed text-slate-600">
                                                    Click another node on the map or select from the dropdown. Paths crossing room boundaries must connect through an Entrance node.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || !edgeNodeA || !edgeNodeB || currentConnectionStatus?.blocked}
                                    className={`w-full py-3 rounded-xl text-white font-bold transition-all shadow-md ${
                                        loading || !edgeNodeA || !edgeNodeB || currentConnectionStatus?.blocked
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-700'
                                    }`}
                                >
                                    {loading
                                        ? 'Creating...'
                                        : currentConnectionStatus?.blocked
                                        ? 'Cannot Connect (Wall Blocked)'
                                        : 'Connect Path Edge'}
                                </button>
                            </form>

                             {/* Edge Filter & Existing Edges List */}
                             <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                                 <div className="flex items-center justify-between">
                                     <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                         <Filter className="w-4 h-4 text-indigo-600" />
                                         Existing Path Edges ({filteredEdges.length}/{edges.length})
                                     </h4>
                                     <div className="flex items-center gap-2">
                                         {edgeNodeA && (
                                             <button
                                                 type="button"
                                                 onClick={() => setFilterByNodeA(!filterByNodeA)}
                                                 className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                                                     filterByNodeA ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                                                 }`}
                                             >
                                                 {filterByNodeA ? 'Node A Only' : 'Show All'}
                                             </button>
                                         )}
                                         {selectedEdgeId && (
                                             <button
                                                 type="button"
                                                 onClick={() => setSelectedEdgeId(null)}
                                                 className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline"
                                             >
                                                 Clear Selection
                                             </button>
                                         )}
                                     </div>
                                 </div>

                                 {/* Search & Type Filters */}
                                 <div className="space-y-2">
                                     <div className="relative">
                                         <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                                         <input
                                             type="text"
                                             placeholder="Filter edges by node name or type..."
                                             value={edgeFilterQuery}
                                             onChange={e => setEdgeFilterQuery(e.target.value)}
                                             className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg bg-gray-50 focus:bg-white border-gray-300"
                                         />
                                     </div>

                                     <div className="flex flex-wrap gap-1">
                                         {['all', 'entrance', 'normal', 'stairs', 'elevator', 'escalator', 'invalid'].map(type => (
                                             <button
                                                 key={type}
                                                 type="button"
                                                 onClick={() => setEdgeFilterType(type)}
                                                 className={`px-2 py-0.5 rounded text-[11px] font-semibold capitalize transition-all ${
                                                     edgeFilterType === type
                                                         ? 'bg-indigo-600 text-white shadow-sm'
                                                         : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                 }`}
                                             >
                                                 {type === 'entrance' ? '🚪 Entrance' : type}
                                             </button>
                                         ))}
                                     </div>
                                 </div>

                                 {/* Filtered Edge List */}
                                 <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                                     {filteredEdges.length === 0 ? (
                                         <div className="text-xs text-gray-400 text-center py-4 italic border border-dashed rounded-lg">
                                             No path edges match filter criteria.
                                         </div>
                                     ) : (
                                         filteredEdges.map(ed => {
                                             const n1 = nodes.find(n => n.id === ed.from_node_id);
                                             const n2 = nodes.find(n => n.id === ed.to_node_id);
                                             const isSelected = selectedEdgeId === ed.id;
                                             const isInvalid = invalidEdgeIds.includes(ed.id);
                                             const isEntEdge = (n1 && isEntranceNode(n1)) || (n2 && isEntranceNode(n2));

                                             return (
                                                 <div
                                                     key={ed.id}
                                                     onClick={() => setSelectedEdgeId(ed.id)}
                                                     className={`p-2.5 rounded-lg border text-xs flex justify-between items-center transition-all cursor-pointer ${
                                                         isSelected
                                                             ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-400'
                                                             : isInvalid
                                                             ? 'bg-red-50 border-red-200'
                                                             : isEntEdge
                                                             ? 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-200'
                                                             : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
                                                     }`}
                                                 >
                                                     <div className="space-y-0.5 overflow-hidden">
                                                         <div className="font-semibold text-gray-800 flex items-center gap-1 truncate">
                                                             <span>{n1?.name || 'Node A'}</span>
                                                             <span className="text-gray-400 font-normal">↔</span>
                                                             <span>{n2?.name || 'Node B'}</span>
                                                         </div>
                                                         <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                                             <span className="font-mono bg-gray-200 px-1 rounded">{ed.distance ? `${ed.distance}m` : '0m'}</span>
                                                             <span className="capitalize font-semibold text-indigo-700">{ed.edge_type || 'normal'}</span>
                                                             {isEntEdge && (
                                                                 <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded text-[9px] flex items-center gap-1">
                                                                     <DoorOpen className="w-2.5 h-2.5 text-emerald-600" /> Entrance Guide
                                                                 </span>
                                                             )}
                                                             {isInvalid && <span className="text-red-600 font-bold">⚠ Invalid</span>}
                                                         </div>
                                                     </div>

                                                     <button
                                                         type="button"
                                                         onClick={(e) => {
                                                             e.stopPropagation();
                                                             handleDeleteEdge(ed.id);
                                                         }}
                                                         title="Delete Edge"
                                                         className="p-1.5 text-red-500 hover:text-white hover:bg-red-600 rounded-md transition-all font-bold ml-2 flex-shrink-0"
                                                     >
                                                         <Trash2 className="w-4 h-4" />
                                                     </button>
                                                 </div>
                                             );
                                         })
                                     )}
                                 </div>
                             </div>
                        </>
                    ) : activeTab === 'boundaries' ? (
                        <div className="space-y-6">
                            {overlappingRoomPairs.length > 0 && (
                                <div className="bg-amber-50 border border-amber-300 text-amber-900 p-3.5 rounded-xl text-xs space-y-1">
                                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                        <span>Fix overlapping rooms warning</span>
                                    </div>
                                    <p>
                                        Overlapping room boundaries detected: {overlappingRoomPairs.map(p => `${p.roomA.name} & ${p.roomB.name}`).join(', ')}. Please adjust corner points to remove boundary overlaps.
                                    </p>
                                </div>
                            )}

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className="block text-sm font-bold text-gray-700 mb-2">1. Select Gallery / Room</label>
                                <select value={selectedRoomId ? `room:${selectedRoomId}` : selectedGalleryId} onChange={handleGalleryChange} className="w-full border-gray-300 rounded-lg p-3 bg-white border">
                                    <option value="">-- Choose a gallery --</option>
                                    {rooms.length > 0 && (
                                        <optgroup label="Saved Rooms">
                                            {rooms.map(room => (
                                                <option key={`room:${room.id}`} value={`room:${room.id}`}>{room.name} ✓</option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {galleries.filter(g => {
                                        const matchMuseum = !selectedMuseumId || g.museum_id.toString() === selectedMuseumId.toString();
                                        if (!matchMuseum) return false;
                                        if (!activeFloorPlan) return true;
                                        const planFloor = activeFloorPlan.floor_number?.toString();
                                        if (!planFloor) return true;
                                        const galFloor = (g.floor || '').toString().trim();
                                        if (!galFloor) return true;
                                        if (galFloor === planFloor) return true;
                                        const cleanGal = galFloor.replace(/[^0-9]/g, '');
                                        const cleanPlan = planFloor.replace(/[^0-9]/g, '');
                                        if (cleanGal && cleanPlan && cleanGal === cleanPlan) return true;
                                        if (galFloor.toLowerCase().includes('ground') && planFloor === '1') return true;
                                        return false;
                                    }).map(g => (
                                        <option key={g.id} value={g.id}>{g.name} (Floor {g.floor || '?'}) {g.boundary_polygon ? '✓' : '✗'}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-sm font-bold text-gray-700">2. Draw Room Boundary</label>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setShowNodesInBoundaries(!showNodesInBoundaries)}
                                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1 ${showNodesInBoundaries ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'}`}
                                            title={showNodesInBoundaries ? "Hide node tags" : "Show node reference"}
                                        >
                                            {showNodesInBoundaries ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            {showNodesInBoundaries ? 'Hide Nodes' : 'Show Nodes'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!selectedRoomId) {
                                                    setMessage({ text: 'Please select a room in Step 1 first before marking an entrance.', type: 'error' });
                                                    return;
                                                }
                                                setDoorwayMode(!doorwayMode);
                                            }}
                                            className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1 ${doorwayMode ? 'bg-sky-600 text-white border-sky-700' : 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100'
                                                }`}
                                        >
                                            <DoorOpen className="w-3.5 h-3.5" /> {doorwayMode ? 'Marking Entrance...' : 'Mark Entrance on Wall'}
                                        </button>
                                    </div>
                                </div>

                                {doorwayMode ? (
                                    <div className="mb-4 text-xs text-sky-950 bg-sky-50 p-3 rounded-lg flex items-start justify-between gap-2 border border-sky-300 animate-pulse">
                                        <div className="flex items-start gap-2">
                                            <DoorOpen className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <strong className="block text-sky-900">Entrance Placement Guide Active</strong>
                                                <span>Click on a wall boundary to add an Entrance node. Paths must pass through an Entrance node to enter/exit this room.</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setDoorwayMode(false)}
                                            className="text-[10px] bg-white border border-sky-300 text-sky-700 px-2 py-0.5 rounded font-bold hover:bg-sky-100"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="mb-4 text-xs text-blue-800 bg-blue-50 p-3 rounded-lg flex items-start gap-2 border border-blue-100">
                                        <MousePointerClick className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                        <span>Click directly on the floor plan image to place corner points. X/Y and Lat/Lng are auto-computed. Place 3+ points to complete a room.</span>
                                    </div>
                                )}

                                <div className="flex gap-2 mb-4">
                                    <button type="button" onClick={() => setPolygonPoints([])} className="flex-1 bg-red-50 text-red-700 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 border border-red-200">Clear All Points</button>
                                </div>

                                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                                    {polygonPoints.length === 0 && <div className="text-center text-gray-500 text-xs italic py-4">No corner points placed yet. Click image to add points.</div>}
                                    {polygonPoints.map((p, i) => {
                                        const nextIdx = (i + 1) % polygonPoints.length;
                                        const nextPt = polygonPoints[nextIdx];
                                        let distStr = '';
                                        if (p.lat != null && p.lng != null && nextPt && nextPt.lat != null && nextPt.lng != null) {
                                            const dist = haversineDistance(p.lat, p.lng, nextPt.lat, nextPt.lng);
                                            distStr = (dist < 10 ? dist.toFixed(1) : Math.round(dist)) + 'm';
                                        }
                                        return (
                                        <React.Fragment key={i}>
                                        <div className={`border p-2.5 rounded-lg text-xs transition-all ${p.is_manually_corrected ? 'bg-purple-50/90 border-purple-300' : 'bg-gray-50 border-gray-200'}`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-gray-800">Pt {i + 1}:</span>
                                                        <span className="text-gray-600 font-mono">({(p.x <= 1.0 ? p.x * 100 : p.x).toFixed(1)}%, {(p.y <= 1.0 ? p.y * 100 : p.y).toFixed(1)}%)</span>
                                                        {p.is_manually_corrected && (
                                                            <span className="bg-purple-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                                                                ★ Corrected
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] font-mono mt-0.5">
                                                        <span className={p.is_manually_corrected ? 'text-purple-700 font-semibold' : 'text-gray-500'}>
                                                            GPS: {p.lat != null ? `${Number(p.lat).toFixed(6)}, ${Number(p.lng).toFixed(6)}` : 'Pending Georeferencing'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (editingPointIdx === i) {
                                                                setEditingPointIdx(null);
                                                            } else {
                                                                setEditingPointIdx(i);
                                                                setEditLat(p.lat != null ? p.lat.toString() : '');
                                                                setEditLng(p.lng != null ? p.lng.toString() : '');
                                                            }
                                                        }}
                                                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors flex items-center gap-1 ${editingPointIdx === i ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                                                            }`}
                                                    >
                                                        <Edit3 className="w-3 h-3" /> {editingPointIdx === i ? 'Close' : 'Edit precise location'}
                                                    </button>
                                                    <div className="flex gap-0.5 bg-white border rounded">
                                                        <button type="button" onClick={() => movePoint(i, -1)} disabled={i === 0} className="p-1 disabled:opacity-30 hover:bg-gray-100 border-r"><ArrowUp className="w-3.5 h-3.5 text-gray-600" /></button>
                                                        <button type="button" onClick={() => movePoint(i, 1)} disabled={i === polygonPoints.length - 1} className="p-1 disabled:opacity-30 hover:bg-gray-100 border-r"><ArrowDown className="w-3.5 h-3.5 text-gray-600" /></button>
                                                        <button type="button" onClick={() => removePoint(i)} className="p-1 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Expandable Precision Editor Panel */}
                                            {editingPointIdx === i && (
                                                <div className="mt-3 pt-3 border-t border-gray-200 bg-white p-3 rounded-lg shadow-xs space-y-3">
                                                    <div className="flex items-start gap-1.5 text-[10px] text-amber-900 bg-amber-50 p-2 rounded border border-amber-200 leading-snug">
                                                        <HelpCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                                        <span>Correcting this point's GPS coordinate updates its position on the map and locks it from being changed by future anchor recalibration.</span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="block text-[9px] font-bold text-gray-600 uppercase mb-1">Latitude</label>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                value={editLat}
                                                                onChange={e => setEditLat(e.target.value)}
                                                                placeholder="e.g. 13.00985"
                                                                className="w-full border-gray-300 rounded p-1.5 text-xs font-mono border bg-gray-50 focus:bg-white"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-bold text-gray-600 uppercase mb-1">Longitude</label>
                                                            <input
                                                                type="number"
                                                                step="any"
                                                                value={editLng}
                                                                onChange={e => setEditLng(e.target.value)}
                                                                placeholder="e.g. 77.57092"
                                                                className="w-full border-gray-300 rounded p-1.5 text-xs font-mono border bg-gray-50 focus:bg-white"
                                                            />
                                                        </div>
                                                    </div>
                                                    {editLat && editLng && (() => {
                                                        const ref = computeReferenceDistances(editLat, editLng);
                                                        if (!ref || (!ref.nearestNodeDist && !ref.nearestAnchorDist)) return null;
                                                        return (
                                                            <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded text-[10px] text-emerald-800 flex flex-wrap items-center gap-1 font-mono">
                                                                <span className="font-semibold text-emerald-900">📏 Real distance:</span>
                                                                {ref.nearestNodeDist && <span>{ref.nearestNodeDist}m to {ref.nearestNodeName}</span>}
                                                                {ref.nearestAnchorDist && <span>· {ref.nearestAnchorDist}m to {ref.nearestAnchorName}</span>}
                                                            </div>
                                                        );
                                                    })()}

                                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                        <button
                                                            type="button"
                                                            onClick={handleUseGPSForPoint}
                                                            className="bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1"
                                                        >
                                                            <MapPin className="w-3 h-3 text-emerald-600" /> Use My GPS Location
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSavePointCorrection(i, editLat, editLng)}
                                                            disabled={loading || !editLat || !editLng}
                                                            className="bg-indigo-600 text-white hover:bg-indigo-700 px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 shadow-xs disabled:opacity-50"
                                                        >
                                                            <Save className="w-3 h-3" /> Save correction
                                                        </button>
                                                        {p.is_manually_corrected && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRevertPointCorrection(i)}
                                                                disabled={loading}
                                                                className="bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1"
                                                            >
                                                                <RefreshCw className="w-3 h-3 text-gray-600" /> Revert to derived
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {polygonPoints.length > 1 && distStr && (
                                            <div className="flex flex-col items-center justify-center -my-0.5 relative z-10">
                                                <div className="w-px h-3 bg-gray-300"></div>
                                                <div className="text-[9px] font-medium text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200 shadow-sm flex items-center gap-1">
                                                    <Ruler className="w-3 h-3 text-gray-400" />
                                                    {distStr} to Pt {nextIdx + 1}
                                                </div>
                                                {i !== polygonPoints.length - 1 && <div className="w-px h-3 bg-gray-300"></div>}
                                            </div>
                                        )}
                                        </React.Fragment>
                                    )})}
                                </div>
                            </div>
                            <button onClick={handleSaveBoundary} disabled={loading || polygonPoints.length < 3} className={`w-full flex items-center justify-center px-6 py-3 rounded-xl text-white font-bold shadow-md transition-all ${loading || polygonPoints.length < 3 ? 'bg-gray-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                                <Save className="w-5 h-5 mr-2" />{loading ? 'Saving...' : 'Save Boundary Polygon'}
                            </button>

                            {/* Room Doorways & Entrances Section */}
                            {selectedRoomId && (() => {
                                const activeRoom = rooms.find(r => r.id === selectedRoomId);
                                const roomDoorways = activeRoom?.doorways || [];
                                return (
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <DoorOpen className="w-4 h-4 text-emerald-600" />
                                                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                                                    Doorways & Entrances ({roomDoorways.length})
                                                </h4>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setDoorwayMode(!doorwayMode)}
                                                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1 ${
                                                    doorwayMode
                                                        ? 'bg-emerald-600 text-white border-emerald-700'
                                                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                                }`}
                                            >
                                                <DoorOpen className="w-3.5 h-3.5" /> {doorwayMode ? 'Marking...' : '+ Mark Doorway'}
                                            </button>
                                        </div>
                                        {roomDoorways.length === 0 ? (
                                            <div className="text-center text-gray-500 text-xs italic py-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                                No doorways marked for this room yet. Click '+ Mark Doorway' to add an entrance connection.
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                                                {roomDoorways.map((d, dIdx) => {
                                                    const connRoom = rooms.find(r => r.id === d.connected_room_id);
                                                    const label = d.name || (connRoom ? `${activeRoom.name} ↔ ${connRoom.name}` : `${activeRoom.name} Entrance`);
                                                    return (
                                                        <div key={d.id || dIdx} className="border border-emerald-100 bg-emerald-50/50 p-2.5 rounded-lg text-xs flex justify-between items-center">
                                                            <div className="space-y-0.5">
                                                                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                                                                    <span>🚪</span>
                                                                    <span>{label}</span>
                                                                </div>
                                                                <div className="text-[10px] text-gray-500 font-mono">
                                                                    Pos: ({((d.x1 + d.x2) / 2 * 100).toFixed(1)}%, {((d.y1 + d.y2) / 2 * 100).toFixed(1)}%)
                                                                    {connRoom && <span className="ml-1.5 text-indigo-600 font-semibold">• Connects to {connRoom.name}</span>}
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteDoorway(d.id)}
                                                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                                                title="Delete doorway opening"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : activeTab === 'footprint' ? (
                        <div className="space-y-6">
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 shadow-sm">
                                <h3 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                                    <ShieldAlert className="w-5 h-5 text-purple-600" /> Draw Building Footprint
                                </h3>
                                <p className="text-xs text-purple-800 leading-relaxed mb-4">
                                    Click corner points around the outer building perimeter. Any nodes or precision GPS corrections outside this boundary will be automatically rejected.
                                </p>

                                <div className="flex gap-2 mb-4">
                                    <button type="button" onClick={() => setFootprintPoints([])} className="flex-1 bg-red-50 text-red-700 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 border border-red-200">Clear Points</button>
                                </div>

                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {footprintPoints.length === 0 && <div className="text-center text-gray-500 text-xs italic py-4">No footprint points defined. Click canvas to add perimeter points.</div>}
                                    {footprintPoints.map((p, i) => (
                                        <div key={i} className="border p-2 rounded-lg bg-white flex justify-between items-center text-xs">
                                            <div>
                                                <span className="font-bold text-purple-900 mr-2">Corner {i + 1}:</span>
                                                <span className="text-gray-600 font-mono">({(p.x <= 1.0 ? p.x * 100 : p.x).toFixed(1)}%, {(p.y <= 1.0 ? p.y * 100 : p.y).toFixed(1)}%)</span>
                                            </div>
                                            <button type="button" onClick={() => setFootprintPoints(prev => prev.filter((_, idx) => idx !== i))} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ))}
                                </div>

                                <button onClick={handleSaveFootprint} disabled={loading || footprintPoints.length < 3} className={`w-full mt-4 flex items-center justify-center px-6 py-3 rounded-xl text-white font-bold shadow-md transition-all ${loading || footprintPoints.length < 3 ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}>
                                    <Save className="w-5 h-5 mr-2" />{loading ? 'Saving...' : 'Save Building Footprint'}
                                </button>
                            </div>
                        </div>
                    ) : activeTab === 'create' ? (
                        <form onSubmit={handleCreateNodeSubmit} className="space-y-6">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Create New Logical Node</h3>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Node Name</label>
                                        <input type="text" required value={newNodeName} onChange={e => setNewNodeName(e.target.value)} placeholder="e.g. Main Entrance" className="w-full border-gray-300 rounded-lg p-2.5 border" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Floor Level</label>
                                        <input type="number" required value={newNodeFloor} onChange={e => setNewNodeFloor(e.target.value)} className="w-full border-gray-300 rounded-lg p-2.5 border" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Node Type</label>
                                         <select value={newNodeType} onChange={e => setNewNodeType(e.target.value)} className="w-full border-gray-300 rounded-lg p-2.5 border bg-white">
                                            <optgroup label="Navigation Checkpoints">
                                                <option value="entrance">Entrance</option>
                                                <option value="exit">Exit</option>
                                                <option value="entrance,exit">Entrance & Exit (Both)</option>
                                                <option value="exhibit">Exhibit / Artifact</option>
                                                <option value="waypoint">Waypoint (Pathing Junction)</option>
                                            </optgroup>
                                            <optgroup label="Amenities & Facilities">
                                                <option value="elevator">Elevator</option>
                                                <option value="stairs">Stairs</option>
                                                <option value="escalator">Escalator</option>
                                                <option value="restroom">Restroom</option>
                                                <option value="fire_extinguisher">Fire Extinguisher</option>
                                                <option value="information_desk">Information Desk</option>
                                                <option value="cafeteria">Cafeteria / Dining</option>
                                                <option value="gift_shop">Gift Shop</option>
                                                <option value="water_fountain">Drinking Water Fountain</option>
                                                <option value="amenity">General Amenity</option>
                                            </optgroup>
                                        </select>
                                    </div>

                                    {(newNodeType === 'exhibit' || newNodeType.includes('artifact')) && (
                                        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                                                    <Package className="w-4 h-4 text-indigo-600" />
                                                    Linked Museum Object <span className="text-red-500 font-bold">*</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewArtifactModal(true)}
                                                    className="text-xs bg-indigo-600 text-white hover:bg-indigo-700 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 shadow-2xs transition-all"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> New Object
                                                </button>
                                            </div>
                                            <select
                                                value={selectedObjectId ? `obj-${selectedObjectId}` : (selectedArtifactId ? `art-${selectedArtifactId}` : '')}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (!val) {
                                                        setSelectedObjectId('');
                                                        setSelectedArtifactId('');
                                                        return;
                                                    }
                                                    if (val.startsWith('obj-')) {
                                                        const objId = val.replace('obj-', '');
                                                        setSelectedObjectId(objId);
                                                        const obj = objects.find(o => o.id.toString() === objId.toString());
                                                        if (obj) {
                                                            if (!newNodeName) setNewNodeName(obj.name);
                                                            const matchArt = artifacts.find(a => a.name?.toLowerCase() === obj.name?.toLowerCase());
                                                            if (matchArt) {
                                                                setSelectedArtifactId(matchArt.id);
                                                            } else {
                                                                setSelectedArtifactId('');
                                                            }
                                                        }
                                                    } else if (val.startsWith('art-')) {
                                                        const artId = val.replace('art-', '');
                                                        setSelectedArtifactId(artId);
                                                        const art = artifacts.find(a => a.id === artId);
                                                        if (art) {
                                                            if (!newNodeName) setNewNodeName(art.name);
                                                            const matchObj = objects.find(o => o.name?.toLowerCase() === art.name?.toLowerCase());
                                                            if (matchObj) {
                                                                setSelectedObjectId(matchObj.id.toString());
                                                            } else {
                                                                setSelectedObjectId('');
                                                            }
                                                        }
                                                    }
                                                }}
                                                className="w-full border border-indigo-200 rounded-lg p-2.5 bg-white text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">-- Choose Existing Object (Required) --</option>
                                                {objects.length > 0 && (
                                                    <optgroup label="Museum Objects Catalog">
                                                        {objects.map(obj => (
                                                            <option key={`obj-${obj.id}`} value={`obj-${obj.id}`}>
                                                                {obj.name} (Object #{obj.id}{obj.category ? ` - ${obj.category}` : ''})
                                                            </option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                                {artifacts.filter(a => !objects.some(o => o.name?.toLowerCase() === a.name?.toLowerCase())).length > 0 && (
                                                    <optgroup label="Floor Plan Standalone Artifacts">
                                                        {artifacts
                                                            .filter(a => !objects.some(o => o.name?.toLowerCase() === a.name?.toLowerCase()))
                                                            .map(a => (
                                                                <option key={`art-${a.id}`} value={`art-${a.id}`}>
                                                                    {a.name} (Floor Plan Artifact)
                                                                </option>
                                                            ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                            {selectedObjectId && (
                                                <div className="flex items-center gap-1.5 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md font-medium">
                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                    <span>Linked to Catalog: <strong>{objects.find(o => o.id.toString() === selectedObjectId.toString())?.name || `Object #${selectedObjectId}`}</strong></span>
                                                </div>
                                            )}
                                            {objects.length === 0 && artifacts.length === 0 && (
                                                <p className="text-[11px] text-amber-800 font-medium">
                                                    No museum objects found. Click <strong>+ New Object</strong> above to register one in the catalog.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {nodeX != null && nodeY != null && (
                                        <div className="bg-slate-100 p-2.5 rounded-lg text-xs font-mono text-slate-600 flex justify-between">
                                            <span>Normalized: ({(nodeX * 100).toFixed(1)}%, {(nodeY * 100).toFixed(1)}%)</span>
                                            <span>Px: ({Math.round(nodeX * (activeFloorPlan?.width_px || 1000))}, {Math.round(nodeY * (activeFloorPlan?.height_px || 1000))})</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !newNodeName || ((newNodeType === 'exhibit' || newNodeType.includes('artifact')) && !selectedArtifactId && !selectedObjectId)}
                                className={`w-full flex items-center justify-center px-6 py-3 rounded-xl text-white font-bold shadow-md transition-all ${
                                    loading || !newNodeName || ((newNodeType === 'exhibit' || newNodeType.includes('artifact')) && !selectedArtifactId && !selectedObjectId)
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                            >
                                {loading ? 'Creating...' : 'Create Node'}
                            </button>
                        </form>
                    ) : activeTab === 'wifi-survey' ? (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
                                    <Wifi className="w-5 h-5 text-cyan-600" />
                                    WiFi RSS Survey Mode
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Review room fingerprint coverage and view recorded survey points for live indoor positioning.
                                </p>
                            </div>

                            {/* Room Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                    Select Room to Review Coverage
                                </label>
                                <select
                                    value={surveyRoomId}
                                    onChange={(e) => {
                                        setSurveyRoomId(e.target.value);
                                        fetchWifiCoverage(e.target.value);
                                    }}
                                    className="w-full border border-slate-300 rounded-xl p-3 bg-white text-sm font-semibold text-slate-800 shadow-sm focus:ring-2 focus:ring-cyan-500"
                                >
                                    <option value="">-- Choose a Room --</option>
                                    {rooms.map(r => (
                                        <option key={r.id} value={r.id}>{r.name} ({r.room_type || 'room'})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Coverage Check Card */}
                            {surveyRoomId && (
                                <div className={`p-4 rounded-xl border ${
                                    !roomCoverage || roomCoverage.count === 0
                                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                                        : roomCoverage.is_sparse
                                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider">Room Coverage Status</span>
                                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
                                            !roomCoverage || roomCoverage.count === 0
                                                ? 'bg-slate-200 text-slate-700'
                                                : roomCoverage.is_sparse
                                                    ? 'bg-amber-200 text-amber-800'
                                                    : 'bg-emerald-200 text-emerald-800'
                                        }`}>
                                            {loadingCoverage ? 'Checking...' : (roomCoverage?.status || 'empty')}
                                        </span>
                                    </div>
                                    <div className="text-2xl font-black mb-1">
                                        {roomCoverage?.count ?? 0} Survey Points
                                    </div>
                                    <p className="text-xs opacity-90">
                                        {roomCoverage?.message || 'Select a room to evaluate coverage.'}
                                    </p>
                                </div>
                            )}

                            {/* Informational Guidance for Physical Scanning */}
                            <div className="bg-cyan-50 border border-cyan-200 p-3.5 rounded-xl text-xs text-cyan-950 space-y-1.5">
                                <div className="font-bold flex items-center gap-1.5 text-cyan-900">
                                    <Radio className="w-4 h-4 text-cyan-600" />
                                    Live On-Site Survey Instructions:
                                </div>
                                <p className="text-[11px] leading-relaxed text-cyan-900/90">
                                    Physical WiFi RSS scanning requires native Android hardware. Walk to physical locations within this room with an Android device running the Vanalok app, open <strong>WiFi Survey Mode</strong>, tap the floor plan where you are standing, and save the fingerprint.
                                </p>
                                <p className="text-[10px] text-cyan-800 font-medium">
                                    Note: iOS strictly restricts nearby WiFi BSSID scanning; survey & live correction are Android-only.
                                </p>
                            </div>

                            {/* Running Points Checklist / Table */}
                            {surveyRoomId && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                            Surveyed Coordinates Checklist ({roomFingerprints.length})
                                        </h4>
                                        <button
                                            onClick={() => fetchWifiCoverage(surveyRoomId)}
                                            className="text-xs text-cyan-700 hover:text-cyan-900 font-bold flex items-center gap-1"
                                        >
                                            <RefreshCw className="w-3 h-3" /> Refresh
                                        </button>
                                    </div>

                                    {loadingCoverage ? (
                                        <div className="text-center py-6 text-slate-400 text-xs font-medium">Loading survey points...</div>
                                    ) : roomFingerprints.length === 0 ? (
                                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-center text-xs text-slate-500 font-medium">
                                            No WiFi survey points recorded for this room yet.
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                            {roomFingerprints.map((fp, idx) => (
                                                <div key={fp.id} className="p-2.5 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="w-5 h-5 rounded-full bg-cyan-100 text-cyan-800 font-bold flex items-center justify-center text-[10px]">
                                                            {idx + 1}
                                                        </span>
                                                        <div>
                                                            <div className="font-semibold text-slate-800">
                                                                ({(fp.x * 100).toFixed(1)}%, {(fp.y * 100).toFixed(1)}%)
                                                            </div>
                                                            <div className="text-[10px] text-slate-400">
                                                                {fp.readings?.length || 0} APs • {fp.surveyed_at ? new Date(fp.surveyed_at).toLocaleDateString() : 'Recorded'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteFingerprint(fp.id)}
                                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                                                        title="Delete survey point"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* Canvas View: Uploaded Floor Plan Image + Interactive SVG Overlay OR Preview Mode */}
                <div className="lg:col-span-2">
                    {/* Floor Plan Management Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                                <Layers className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-bold text-slate-900">
                                        {activeFloorPlan ? activeFloorPlan.name : 'No Floor Plan Selected'}
                                    </h4>
                                    {activeFloorPlan && (
                                        <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-100/80 text-indigo-800 rounded-lg border border-indigo-200">
                                            Floor {activeFloorPlan.floor_number}
                                        </span>
                                    )}
                                    {isGeoreferenced && (
                                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md border border-emerald-200">
                                            Georeferenced
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {activeFloorPlan?.image_url && !imageLoadError
                                        ? `Schematic: ${activeFloorPlan.image_url.split('/').pop()}`
                                        : (activeFloorPlan ? 'No schematic image attached to this floor' : 'Select or create a floor plan')}
                                </p>
                            </div>
                        </div>

                        {activeFloorPlan && (
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Replace / Upload Image Button */}
                                <label
                                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-all ${
                                        isUploadingImage
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                            : activeFloorPlan.image_url
                                                ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300'
                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                                    }`}
                                    title={activeFloorPlan.image_url ? "Replace existing floor plan image with a new file" : "Upload a floor plan image file"}
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    {isUploadingImage ? 'Processing...' : (activeFloorPlan.image_url ? 'Replace Image' : 'Upload Image')}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleDirectImageUpload}
                                        disabled={isUploadingImage}
                                        value=""
                                    />
                                </label>

                                {/* Delete Image Button */}
                                {activeFloorPlan.image_url && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteFloorPlanImage}
                                        disabled={isUploadingImage || loading}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all disabled:opacity-50"
                                        title="Delete current floor plan image (preserves placed nodes and room boundaries)"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete Image
                                    </button>
                                )}

                                {/* Clear All Marks & Boundaries Button */}
                                <button
                                    type="button"
                                    onClick={handleClearFloorPlanData}
                                    disabled={isUploadingImage || loading}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 hover:border-amber-400 rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all disabled:opacity-50"
                                    title="Clear all nodes, room boundaries, and walkpaths on this floor plan for a fresh clean slate"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                    Clear Marks & Paths
                                </button>

                                {/* Delete Floor Plan Button */}
                                <button
                                    type="button"
                                    onClick={handleDeleteFloorPlan}
                                    disabled={isUploadingImage || loading}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-red-50 text-slate-500 hover:text-red-700 border border-slate-200 hover:border-red-200 rounded-xl text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                                    title="Delete this entire floor plan level"
                                >
                                    <XCircle className="w-3.5 h-3.5" />
                                    Delete Plan
                                </button>
                            </div>
                        )}
                    </div>

                    {showPreview ? (
                        // PREVIEW MODE: Visitor-facing lightweight map display
                        <div className="bg-slate-900 rounded-xl w-full flex flex-col items-center justify-center border border-gray-200 relative overflow-hidden p-2 min-h-[550px]">
                            <div className="absolute top-2 right-2 z-10 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                                <Eye className="w-3 h-3" /> Preview Mode (Visitor View)
                            </div>
                            {activeFloorPlan && activeFloorPlan.image_url && !imageLoadError ? (
                                <div
                                    ref={imageContainerRef}
                                    className="relative select-none inline-block max-w-full rounded-lg shadow-md overflow-hidden bg-slate-950"
                                    style={{ cursor: 'default' }}
                                >
                                    <img
                                        ref={imageRef}
                                        src={getFloorPlanImageUrl(activeFloorPlan.image_url)}
                                        alt={activeFloorPlan.name || 'Floor Plan'}
                                        className="block max-w-full max-h-[700px] w-auto h-auto mx-auto pointer-events-none"
                                        onError={() => setImageLoadError(true)}
                                    />
                                    <svg
                                        className="absolute inset-0 w-full h-full pointer-events-none"
                                        viewBox="0 0 100 100"
                                        preserveAspectRatio="none"
                                    >
                                        {/* Render Edges Only (No Admin Overlays) */}
                                        {edges
                                            .filter(e => e.floor === activeFloorPlan.floor_number)
                                            .map(edge => {
                                                const nodeA = nodes.find(n => n.id === edge.node_a_id);
                                                const nodeB = nodes.find(n => n.id === edge.node_b_id);
                                                if (!nodeA || !nodeB) return null;
                                                
                                                const x1 = (nodeA.x_coordinate <= 1.0 ? nodeA.x_coordinate * 100 : nodeA.x_coordinate) || 0;
                                                const y1 = (nodeA.y_coordinate <= 1.0 ? nodeA.y_coordinate * 100 : nodeA.y_coordinate) || 0;
                                                const x2 = (nodeB.x_coordinate <= 1.0 ? nodeB.x_coordinate * 100 : nodeB.x_coordinate) || 0;
                                                const y2 = (nodeB.y_coordinate <= 1.0 ? nodeB.y_coordinate * 100 : nodeB.y_coordinate) || 0;
                                                
                                                return (
                                                    <line
                                                        key={`preview_edge_${edge.id}`}
                                                        x1={x1}
                                                        y1={y1}
                                                        x2={x2}
                                                        y2={y2}
                                                        stroke="#94a3b8"
                                                        strokeWidth="0.8"
                                                    />
                                                );
                                            })}

                                        {/* Render Rooms Polygons (Read-only) */}
                                        {rooms
                                            .filter(r => r.floor_plan_id === activeFloorPlan.id)
                                            .map(room => {
                                                if (!room.boundaries || room.boundaries.length < 3) return null;
                                                const pointsStr = getSortedPolygonPoints(room.boundaries).map(p => {
                                                    const xPct = p.x != null ? (p.x <= 1.0 ? p.x * 100 : p.x) : 0;
                                                    const yPct = p.y != null ? (p.y <= 1.0 ? p.y * 100 : p.y) : 0;
                                                    return `${xPct},${yPct}`;
                                                }).join(' ');
                                                
                                                return (
                                                    <polygon
                                                        key={`preview_room_${room.id}`}
                                                        points={pointsStr}
                                                        fill="rgba(99, 102, 241, 0.1)"
                                                        stroke="#6366f1"
                                                        strokeWidth="0.7"
                                                        strokeDasharray="2,2"
                                                    />
                                                );
                                            })}

                                        {/* Render Nodes Only (Minimal, Visitor-Facing) */}
                                        {nodes
                                            .filter(n => n.floor === activeFloorPlan.floor_number)
                                            .map(n => {
                                                const xPct = (n.x_coordinate <= 1.0 ? n.x_coordinate * 100 : n.x_coordinate) || 0;
                                                const yPct = (n.y_coordinate <= 1.0 ? n.y_coordinate * 100 : n.y_coordinate) || 0;
                                                return (
                                                    <circle
                                                        key={`preview_node_${n.id}`}
                                                        cx={xPct}
                                                        cy={yPct}
                                                        r="1.2"
                                                        fill={isEntrance(n) || isExit(n) ? "#3b82f6" : "#64748b"}
                                                        stroke="white"
                                                        strokeWidth="0.3"
                                                    />
                                                );
                                            })}
                                    </svg>
                                </div>
                            ) : (
                                <div className="text-center p-8 text-gray-400 max-w-md mx-auto">
                                    <Layers className="w-14 h-14 text-indigo-300 mx-auto mb-3 opacity-50" />
                                    <p className="font-bold text-base text-gray-300">Preview: No Floor Plan Image</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-slate-900 rounded-xl w-full flex flex-col items-center justify-center border border-gray-200 relative overflow-hidden p-2 min-h-[550px]">
                        {activeFloorPlan && activeFloorPlan.image_url && !imageLoadError && (
                            <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-700/80 shadow-lg text-xs text-white">
                                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider px-1">Layers:</span>
                                
                                {/* Node Marks Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setUserLayerOverrides(prev => ({ ...prev, nodes: !showNodes }))}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                        showNodes 
                                            ? 'bg-indigo-600 text-white shadow-xs' 
                                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                    }`}
                                    title="Toggle node marks visibility on canvas"
                                >
                                    <MapPin className="w-3 h-3" />
                                    <span>Marks {nodes.length > 0 ? `(${nodes.length})` : ''}</span>
                                </button>

                                {/* Walkpaths Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setUserLayerOverrides(prev => ({ ...prev, paths: !showPaths }))}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                        showPaths 
                                            ? 'bg-pink-600 text-white shadow-xs' 
                                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                    }`}
                                    title="Toggle walkpaths / edge lines visibility on canvas"
                                >
                                    <Navigation className="w-3 h-3" />
                                    <span>Paths {edges.length > 0 ? `(${edges.length})` : ''}</span>
                                </button>

                                {/* Room Boundaries Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setUserLayerOverrides(prev => ({ ...prev, boundaries: !showBoundaries }))}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                        showBoundaries 
                                            ? 'bg-emerald-600 text-white shadow-xs' 
                                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                    }`}
                                    title="Toggle room boundary polygons visibility on canvas"
                                >
                                    <DoorOpen className="w-3 h-3" />
                                    <span>Boundaries {rooms.length > 0 ? `(${rooms.length})` : ''}</span>
                                </button>

                                {/* Room Labels Toggle */}
                                <button
                                    type="button"
                                    onClick={() => setUserLayerOverrides(prev => ({ ...prev, labels: !showRoomLabels }))}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                        showRoomLabels 
                                            ? 'bg-amber-600 text-white shadow-xs' 
                                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                                    }`}
                                    title="Toggle room labels on canvas"
                                >
                                    <span>Labels</span>
                                </button>
                            </div>
                        )}
                        {activeFloorPlan && activeFloorPlan.image_url && !imageLoadError && (
                            <div className="absolute top-3 right-3 z-30 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-700/80 shadow-lg">
                                <label
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all"
                                    title="Replace floor plan image"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    {isUploadingImage ? 'Uploading...' : 'Replace Image'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleDirectImageUpload}
                                        disabled={isUploadingImage}
                                        value=""
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={handleDeleteFloorPlanImage}
                                    disabled={isUploadingImage}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-300 hover:text-white bg-rose-950/70 hover:bg-rose-600 rounded-lg text-xs font-bold border border-rose-800/60 hover:border-rose-600 shadow-xs cursor-pointer transition-all disabled:opacity-50"
                                    title="Delete floor plan image"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Delete Image
                                </button>
                            </div>
                        )}
                        {activeFloorPlan && activeFloorPlan.image_url && !imageLoadError ? (
                            <div
                                ref={imageContainerRef}
                                className="relative cursor-crosshair select-none inline-block max-w-full rounded-lg shadow-md overflow-hidden bg-slate-950"
                                onClick={handleCanvasClick}
                            >
                                <img
                                    ref={imageRef}
                                    src={getFloorPlanImageUrl(activeFloorPlan.image_url)}
                                    alt={activeFloorPlan.name || 'Floor Plan'}
                                    className="block max-w-full max-h-[700px] w-auto h-auto mx-auto pointer-events-none"
                                    onError={() => setImageLoadError(true)}
                                />
                                <svg
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                    viewBox="0 0 100 100"
                                    preserveAspectRatio="none"
                                >
                                    {/* Saved Building Footprint Overlay */}
                                    {footprintPoints && footprintPoints.length >= 3 && (
                                        <g key="building_footprint_group">
                                            <polygon
                                                points={getSortedPolygonPoints(footprintPoints).map(p => {
                                                    const xPct = p.x != null ? (p.x <= 1.0 ? p.x * 100 : p.x) : 0;
                                                    const yPct = p.y != null ? (p.y <= 1.0 ? p.y * 100 : p.y) : 0;
                                                    return `${xPct},${yPct}`;
                                                }).join(' ')}
                                                fill="rgba(124, 58, 237, 0.08)"
                                                stroke="#7c3aed"
                                                strokeWidth="1.2"
                                                strokeDasharray="3,2"
                                            />
                                        </g>
                                    )}
                                    {showBoundaries && rooms.map((room, rIdx) => {
                                        if (!room.boundaries || room.boundaries.length < 3) return null;
                                        const pointsStr = room.boundaries.map(b => {
                                            const xPct = b.x <= 1.0 ? b.x * 100 : b.x;
                                            const yPct = b.y <= 1.0 ? b.y * 100 : b.y;
                                            return `${xPct},${yPct}`;
                                        }).join(' ');

                                        const isContaining = nodeX != null && nodeY != null && containingRooms.some(cr => cr.id === room.id);
                                        const isSelected = selectedRoomId && room.id === selectedRoomId;

                                        let sumX = 0, sumY = 0;
                                        room.boundaries.forEach(b => {
                                            sumX += (b.x <= 1.0 ? b.x * 100 : b.x);
                                            sumY += (b.y <= 1.0 ? b.y * 100 : b.y);
                                        });
                                        const cX = sumX / room.boundaries.length;
                                        const cY = sumY / room.boundaries.length;

                                        return (
                                            <g key={`room_poly_${room.id || rIdx}`}>
                                                <polygon
                                                    points={pointsStr}
                                                    fill={
                                                        isContaining
                                                            ? "rgba(59, 130, 246, 0.35)"
                                                            : isSelected
                                                                ? "rgba(99, 102, 241, 0.25)"
                                                                : "rgba(241, 245, 249, 0.12)"
                                                    }
                                                    stroke={
                                                        isContaining
                                                            ? "#2563eb"
                                                            : isSelected
                                                                ? "#4f46e5"
                                                                : room.walkable ? "#64748b" : "#ef4444"
                                                    }
                                                    strokeWidth={isContaining ? "1.5" : isSelected ? "1.0" : "0.5"}
                                                    strokeDasharray={isContaining ? undefined : "2,2"}
                                                />
                                                {(showRoomLabels || isContaining || isSelected) && (
                                                    <text
                                                        x={cX}
                                                        y={cY}
                                                        textAnchor="middle"
                                                        dominantBaseline="middle"
                                                        fontSize="2.5"
                                                        fontWeight="bold"
                                                        fill={isContaining ? "#1e40af" : "#475569"}
                                                        className="pointer-events-none select-none"
                                                    >
                                                        {room.name} {isContaining ? '✓' : ''}
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    })}

                                    {/* Render All Saved Doorways / Entrances on Floor Plan */}
                                    {(showBoundaries || showPaths) && rooms.map(room => {
                                        if (!room.doorways || room.doorways.length === 0) return null;
                                        return room.doorways.map((d, dIdx) => {
                                            const x1Pct = (d.x1 <= 1.0 ? d.x1 * 100 : d.x1);
                                            const y1Pct = (d.y1 <= 1.0 ? d.y1 * 100 : d.y1);
                                            const x2Pct = (d.x2 <= 1.0 ? d.x2 * 100 : d.x2);
                                            const y2Pct = (d.y2 <= 1.0 ? d.y2 * 100 : d.y2);
                                            const midX = (x1Pct + x2Pct) / 2;
                                            const midY = (y1Pct + y2Pct) / 2;
                                            const isThisRoomSelected = selectedRoomId && room.id === selectedRoomId;
                                            const connectedRoom = rooms.find(r => r.id === d.connected_room_id);
                                            const doorTitle = d.name || (connectedRoom ? `${room.name} ↔ ${connectedRoom.name}` : `${room.name} Entrance`);

                                            return (
                                                <g
                                                    key={`doorway_${d.id || `${room.id}_${dIdx}`}`}
                                                    className="cursor-pointer group"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm(`Doorway: ${doorTitle}\nDelete this doorway opening?`)) {
                                                            handleDeleteDoorway(d.id);
                                                        }
                                                    }}
                                                >
                                                    {/* Thick clickable hit area */}
                                                    <line
                                                        x1={x1Pct} y1={y1Pct} x2={x2Pct} y2={y2Pct}
                                                        stroke="transparent"
                                                        strokeWidth="6"
                                                        className="pointer-events-auto"
                                                    />
                                                    {/* Opening gap guide line on wall */}
                                                    <line
                                                        x1={x1Pct} y1={y1Pct} x2={x2Pct} y2={y2Pct}
                                                        stroke={isThisRoomSelected ? "#38bdf8" : "#94a3b8"}
                                                        strokeWidth="1.2"
                                                        strokeDasharray="2,1.5"
                                                        strokeLinecap="round"
                                                        className="pointer-events-none drop-shadow-xs"
                                                    />
                                                    {/* Entrance Location Guide Marker */}
                                                    <g transform={`translate(${midX}, ${midY})`} className="pointer-events-auto">
                                                        <circle
                                                            r="1.3"
                                                            fill={isThisRoomSelected ? "#0284c7" : "#64748b"}
                                                            stroke="#ffffff"
                                                            strokeWidth="0.25"
                                                            className="transition-transform group-hover:scale-125"
                                                        />
                                                        <text
                                                            x="0"
                                                            y="0.3"
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                            fill="#ffffff"
                                                            fontSize="1.0"
                                                            fontWeight="bold"
                                                            className="select-none pointer-events-none"
                                                        >
                                                            🚪
                                                        </text>
                                                        <title>{`${doorTitle} (Entrance guide - click to delete)`}</title>
                                                    </g>
                                                </g>
                                            );
                                        });
                                    })}

                                    {/* Active Entrance Wall Guide Preview */}
                                    {pendingDoorway && (
                                        <g key="pending_doorway_preview">
                                            <line
                                                x1={(pendingDoorway.p1.x <= 1.0 ? pendingDoorway.p1.x * 100 : pendingDoorway.p1.x)}
                                                y1={(pendingDoorway.p1.y <= 1.0 ? pendingDoorway.p1.y * 100 : pendingDoorway.p1.y)}
                                                x2={(pendingDoorway.p2.x <= 1.0 ? pendingDoorway.p2.x * 100 : pendingDoorway.p2.x)}
                                                y2={(pendingDoorway.p2.y <= 1.0 ? pendingDoorway.p2.y * 100 : pendingDoorway.p2.y)}
                                                stroke="#0284c7"
                                                strokeWidth="1.6"
                                                strokeDasharray="2,1"
                                                strokeLinecap="round"
                                            />
                                            <circle
                                                cx={(pendingDoorway.snapX <= 1.0 ? pendingDoorway.snapX * 100 : pendingDoorway.snapX)}
                                                cy={(pendingDoorway.snapY <= 1.0 ? pendingDoorway.snapY * 100 : pendingDoorway.snapY)}
                                                r="1.6"
                                                fill="#0284c7"
                                                stroke="#ffffff"
                                                strokeWidth="0.3"
                                            />
                                        </g>
                                    )}

                                    {/* Background Galleries Polygons */}
                                    {showBoundaries && galleries
                                        .filter(g => g.boundary_polygon && g.boundary_polygon.length >= 3)
                                        .filter(g => {
                                            if (!activeFloorPlan) return false;
                                            const gFloor = String(g.floor ?? '').replace(/\D/g, '');
                                            const fpFloor = String(activeFloorPlan.floor_number ?? '');
                                            const gMuseum = g.museum_id ? String(g.museum_id) : '';
                                            const fpMuseum = activeFloorPlan.museum_id ? String(activeFloorPlan.museum_id) : '';
                                            return (!gFloor || gFloor === fpFloor) && (!gMuseum || !fpMuseum || gMuseum === fpMuseum);
                                        })
                                        .map((g, gIdx) => {
                                            const ptsStr = getSortedPolygonPoints(g.boundary_polygon).map(p => {
                                                const xPct = p.x != null ? (p.x <= 1.0 ? p.x * 100 : p.x) : 0;
                                                const yPct = p.y != null ? (p.y <= 1.0 ? p.y * 100 : p.y) : 0;
                                                return `${xPct},${yPct}`;
                                            }).join(' ');
                                            const isSel = selectedGalleryId && g.id.toString() === selectedGalleryId.toString();
                                            return (
                                                <polygon
                                                    key={`gal_poly_${g.id || gIdx}`}
                                                    points={ptsStr}
                                                    fill={isSel ? "rgba(99, 102, 241, 0.3)" : "rgba(148, 163, 184, 0.2)"}
                                                    stroke={isSel ? "#4f46e5" : "#64748b"}
                                                    strokeWidth={isSel ? "0.8" : "0.4"}
                                                />
                                            );
                                        })}

                                    {/* Active Drawing Boundary Draft */}
                                    {polygonPoints.length >= 2 && (
                                        <g>
                                            <polygon
                                                points={getSortedPolygonPoints(polygonPoints).map(p => {
                                                    const xPct = p.x != null ? (p.x <= 1.0 ? p.x * 100 : p.x) : 0;
                                                    const yPct = p.y != null ? (p.y <= 1.0 ? p.y * 100 : p.y) : 0;
                                                    return `${xPct},${yPct}`;
                                                }).join(' ')}
                                                fill="rgba(245, 158, 11, 0.3)"
                                                stroke="#f59e0b"
                                                strokeWidth="0.8"
                                                strokeDasharray="1,1"
                                            />
                                        </g>
                                    )}

                                {/* Top Floating Action Bar for Selected Edge */}
                                {selectedEdgeId && activeTab === 'edges' && (() => {
                                    const selEdge = edges.find(e => e.id === selectedEdgeId);
                                    if (!selEdge) return null;
                                    const n1 = nodes.find(n => n.id === selEdge.from_node_id);
                                    const n2 = nodes.find(n => n.id === selEdge.to_node_id);
                                    const isInvalid = invalidEdgeIds.includes(selEdge.id);
                                    return (
                                        <div className="absolute top-3 left-3 right-3 bg-slate-900/90 text-white backdrop-blur border border-indigo-500/50 p-2.5 rounded-xl shadow-lg flex justify-between items-center z-20 text-xs">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <span className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-ping"></span>
                                                <span className="font-bold text-indigo-200 truncate">{n1?.name || 'Node A'} ↔ {n2?.name || 'Node B'}</span>
                                                <span className="text-gray-300 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                                    {selEdge.distance ? `${selEdge.distance}m` : '0m'}
                                                </span>
                                                <span className="capitalize font-semibold text-indigo-400">({selEdge.edge_type || 'normal'})</span>
                                                {isInvalid && <span className="text-red-400 font-bold bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800">⚠ Out of room boundary</span>}
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteEdge(selEdge.id);
                                                    }}
                                                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1 transition-all shadow"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" /> Delete Edge
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedEdgeId(null);
                                                    }}
                                                    className="text-gray-400 hover:text-white text-xs px-1.5 py-1"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Edges Lines */}
                                {showPaths && edges.map(edge => {
                                    const n1 = nodes.find(n => n.id === edge.from_node_id);
                                    const n2 = nodes.find(n => n.id === edge.to_node_id);
                                    if (!n1 || !n2) return null;
                                    const x1 = (n1.x_coordinate <= 1.0 ? n1.x_coordinate * 100 : n1.x_coordinate) || 0;
                                    const y1 = (n1.y_coordinate <= 1.0 ? n1.y_coordinate * 100 : n1.y_coordinate) || 0;
                                    const x2 = (n2.x_coordinate <= 1.0 ? n2.x_coordinate * 100 : n2.x_coordinate) || 0;
                                    const y2 = (n2.y_coordinate <= 1.0 ? n2.y_coordinate * 100 : n2.y_coordinate) || 0;

                                    const isSelected = selectedEdgeId === edge.id;
                                    const isInvalid = invalidEdgeIds.includes(edge.id);
                                    const isFC = ['stairs', 'elevator', 'escalator'].includes(edge.edge_type);
                                    const isEntEdge = (n1 && isEntranceNode(n1)) || (n2 && isEntranceNode(n2));

                                    return (
                                        <g key={`edge_group_${edge.id}`} className="cursor-pointer">
                                            <line
                                                x1={x1} y1={y1} x2={x2} y2={y2}
                                                stroke="transparent"
                                                strokeWidth="5"
                                                className="pointer-events-auto"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedEdgeId(edge.id);
                                                    setActiveTab('edges');
                                                }}
                                            />
                                            <line
                                                x1={x1} y1={y1} x2={x2} y2={y2}
                                                stroke={isSelected ? "#ec4899" : isInvalid ? "#ef4444" : isFC ? "#f59e0b" : "#64748b"}
                                                strokeWidth={isSelected ? "2.5" : isInvalid ? "1.4" : "0.7"}
                                                strokeDasharray={isSelected ? undefined : isInvalid ? "1,1" : "2,2"}
                                                className="pointer-events-none transition-all"
                                            />
                                        </g>
                                    );
                                })}

                                {/* Active Connection Guide Line Preview */}
                                {showPaths && activeTab === 'edges' && nodeA && nodeB && (() => {
                                    const ax = (nodeA.x_coordinate <= 1.0 ? nodeA.x_coordinate * 100 : nodeA.x_coordinate) || 0;
                                    const ay = (nodeA.y_coordinate <= 1.0 ? nodeA.y_coordinate * 100 : nodeA.y_coordinate) || 0;
                                    const bx = (nodeB.x_coordinate <= 1.0 ? nodeB.x_coordinate * 100 : nodeB.x_coordinate) || 0;
                                    const by = (nodeB.y_coordinate <= 1.0 ? nodeB.y_coordinate * 100 : nodeB.y_coordinate) || 0;
                                    const mx = (ax + bx) / 2;
                                    const my = (ay + by) / 2;
                                    const isBlocked = currentConnectionStatus?.blocked;

                                    return (
                                        <g key="interactive_edge_preview" className="pointer-events-none transition-all">
                                            <line
                                                x1={ax} y1={ay} x2={bx} y2={by}
                                                stroke={isBlocked ? "#ef4444" : "#64748b"}
                                                strokeWidth={isBlocked ? "1.0" : "0.8"}
                                                strokeDasharray={isBlocked ? "1.5,1" : "2,2"}
                                                className={isBlocked ? "animate-pulse" : ""}
                                            />
                                            {isBlocked && currentConnectionStatus?.collisionPoint && (
                                                <g>
                                                    <circle
                                                        cx={currentConnectionStatus.collisionPoint.x}
                                                        cy={currentConnectionStatus.collisionPoint.y}
                                                        r="1.4"
                                                        fill="#ef4444"
                                                        stroke="#ffffff"
                                                        strokeWidth="0.3"
                                                        className="animate-ping"
                                                    />
                                                    <circle
                                                        cx={currentConnectionStatus.collisionPoint.x}
                                                        cy={currentConnectionStatus.collisionPoint.y}
                                                        r="0.9"
                                                        fill="#b91c1c"
                                                        stroke="#ffffff"
                                                        strokeWidth="0.2"
                                                    />
                                                </g>
                                            )}
                                            {isBlocked && (
                                                <g transform={`translate(${mx}, ${my})`}>
                                                    <rect
                                                        x={-14}
                                                        y={-1.8}
                                                        width={28}
                                                        height="3.6"
                                                        rx="1.8"
                                                        fill="#991b1b"
                                                        stroke="#f87171"
                                                        strokeWidth="0.3"
                                                    />
                                                    <text
                                                        x="0"
                                                        y="0.4"
                                                        textAnchor="middle"
                                                        dominantBaseline="middle"
                                                        fill="#ffffff"
                                                        fontSize="1.2"
                                                        fontWeight="bold"
                                                        className="select-none"
                                                    >
                                                        {`⛔ Wall Blocked (${currentConnectionStatus.roomName || 'Wall'})`}
                                                    </text>
                                                </g>
                                            )}
                                        </g>
                                    );
                                })()}
                                </svg>

                                {/* Centered Room Labels */}
                                {showRoomLabels && galleries
                                    .filter(g => g.boundary_polygon && g.boundary_polygon.length >= 3)
                                    .filter(g => {
                                        if (!activeFloorPlan) return false;
                                        const gFloor = String(g.floor ?? '').replace(/\D/g, '');
                                        const fpFloor = String(activeFloorPlan.floor_number ?? '');
                                        const gMuseum = g.museum_id ? String(g.museum_id) : '';
                                        const fpMuseum = activeFloorPlan.museum_id ? String(activeFloorPlan.museum_id) : '';
                                        return (!gFloor || gFloor === fpFloor) && (!gMuseum || !fpMuseum || gMuseum === fpMuseum);
                                    })
                                    .map(g => {
                                        const center = getPolygonCentroid(g.boundary_polygon);
                                        if (!center) return null;
                                        const isActive = activeTab === 'boundaries' && selectedGalleryId && g.id.toString() === selectedGalleryId.toString();
                                        return (
                                            <div
                                                key={`room-label-${g.id}`}
                                                style={{ left: `${center.xPct}%`, top: `${center.yPct}%` }}
                                                className={`absolute -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold px-2 py-0.5 rounded border shadow-xs pointer-events-none whitespace-nowrap ${isActive ? 'bg-indigo-600 text-white border-indigo-700' : 'text-slate-800 bg-white/90 border-slate-300'}`}
                                            >
                                                {g.name}
                                            </div>
                                        );
                                    })}

                                {/* Render Nodes Markers */}
                                {showNodes && nodes.map((n, idx) => {
                                    const xPct = (n.x_coordinate <= 1.0 ? n.x_coordinate * 100 : n.x_coordinate) || 0;
                                    const yPct = (n.y_coordinate <= 1.0 ? n.y_coordinate * 100 : n.y_coordinate) || 0;
                                    const isSelected = selectedNodeId === n.id || edgeNodeA === n.id || edgeNodeB === n.id;
                                    const nIsEnt = isEntrance(n);
                                    const nIsExt = isExit(n);
                                    const isOOB = outOfBoundaryNodeIds.includes(n.id) || (footprintPoints.length >= 3 && isPointInsidePolygon(n.x_coordinate, n.y_coordinate, footprintPoints) === false);
                                    const isBoundaryMode = activeTab === 'boundaries';

                                    return (
                                        <div
                                            key={`node_marker_${n.id}`}
                                            onClick={(e) => {
                                                if (isBoundaryMode) return;
                                                e.stopPropagation();
                                                if (activeTab === 'edges') {
                                                    if (!edgeNodeA) {
                                                        setEdgeNodeA(n.id);
                                                    } else if (edgeNodeA === n.id) {
                                                        setEdgeNodeA('');
                                                        setEdgeNodeB('');
                                                    } else if (!edgeNodeB) {
                                                        setEdgeNodeB(n.id);
                                                    } else if (edgeNodeB === n.id) {
                                                        setEdgeNodeB('');
                                                    } else {
                                                        setEdgeNodeB(n.id);
                                                    }
                                                } else {
                                                    setSelectedNodeId(n.id);
                                                    setNodeX(n.x_coordinate);
                                                    setNodeY(n.y_coordinate);
                                                    if (n.latitude && n.longitude) {
                                                        setLat(n.latitude); setLng(n.longitude);
                                                    }
                                                }
                                            }}
                                            onMouseEnter={() => {
                                                if (activeTab === 'edges' && edgeNodeA && edgeNodeA !== n.id) {
                                                    setHoveredNodeId(n.id);
                                                }
                                            }}
                                            onMouseLeave={() => {
                                                if (hoveredNodeId === n.id) {
                                                    setHoveredNodeId(null);
                                                }
                                            }}
                                            style={{ left: `${xPct}%`, top: `${yPct}%` }}
                                            className={`absolute -translate-x-1/2 -translate-y-1/2 ${isBoundaryMode ? 'pointer-events-none opacity-50' : 'cursor-pointer'} z-10 transition-transform ${isOOB ? 'ring-4 ring-red-500 rounded-full scale-125 z-30' : isSelected ? 'scale-125 z-20' : 'hover:scale-110'}`}
                                        >
                                            {(() => {
                                                if (nIsEnt && nIsExt) {
                                                    return (
                                                        <div className="flex rounded-full overflow-hidden shadow-md border border-white font-bold text-[9px]">
                                                            <span className="bg-emerald-600 text-white px-1.5 py-0.5">ENT</span>
                                                            <span className="bg-red-600 text-white px-1.5 py-0.5">EXIT</span>
                                                        </div>
                                                    );
                                                }
                                                if (nIsEnt) {
                                                    return (
                                                        <div className="bg-emerald-600 text-white font-bold text-[9px] px-2 py-0.5 rounded-full shadow-md border border-white tracking-wide">
                                                            ENTRANCE
                                                        </div>
                                                    );
                                                }
                                                if (nIsExt) {
                                                    return (
                                                        <div className="bg-red-600 text-white font-bold text-[9px] px-2 py-0.5 rounded-full shadow-md border border-white tracking-wide">
                                                            EXIT
                                                        </div>
                                                    );
                                                }
                                                const types = (n.node_type || '').toLowerCase().split(',').map(s => s.trim());
                                                const amenityMap = {
                                                    information_desk: { label: 'INFO', emoji: 'ℹ️', bg: 'bg-sky-600' },
                                                    restroom: { label: 'RESTROOM', emoji: '🚻', bg: 'bg-blue-600' },
                                                    fire_extinguisher: { label: 'FIRE', emoji: '🧯', bg: 'bg-rose-600' },
                                                    water_fountain: { label: 'WATER', emoji: '🚰', bg: 'bg-cyan-600' },
                                                    cafeteria: { label: 'CAFE', emoji: '☕', bg: 'bg-amber-600' },
                                                    cafe: { label: 'CAFE', emoji: '☕', bg: 'bg-amber-600' },
                                                    gift_shop: { label: 'SHOP', emoji: '🛍️', bg: 'bg-pink-600' },
                                                    giftshop: { label: 'SHOP', emoji: '🛍️', bg: 'bg-pink-600' },
                                                    elevator: { label: 'ELEV', emoji: '🛗', bg: 'bg-indigo-600' },
                                                    stairs: { label: 'STAIRS', emoji: '📶', bg: 'bg-amber-700' },
                                                    escalator: { label: 'ESCAL', emoji: '🪜', bg: 'bg-teal-600' },
                                                    first_aid: { label: 'MED', emoji: '🩹', bg: 'bg-red-700' },
                                                    atm: { label: 'ATM', emoji: '🏧', bg: 'bg-emerald-700' },
                                                    exhibit: { label: 'ART', emoji: '🖼️', bg: 'bg-purple-600' },
                                                    artifact: { label: 'ART', emoji: '🖼️', bg: 'bg-purple-600' },
                                                    doorway: { label: 'DOOR', emoji: '🚪', bg: 'bg-amber-500' }
                                                };
                                                for (const t of types) {
                                                    if (amenityMap[t]) {
                                                        const { label, emoji, bg } = amenityMap[t];
                                                        return (
                                                            <div className={`${bg} text-white font-bold text-[9px] px-2 py-0.5 rounded-full shadow-md border border-white flex items-center gap-1 whitespace-nowrap`}>
                                                                <span>{emoji}</span>
                                                                <span>{label}</span>
                                                            </div>
                                                        );
                                                    }
                                                }
                                                return (
                                                    <div className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-white shadow-sm ${isOOB ? 'bg-red-600 ring-2 ring-red-300' : isSelected ? 'bg-emerald-500 ring-2 ring-emerald-300' : 'bg-slate-800'}`}>
                                                        {idx + 1}
                                                    </div>
                                                );
                                            })()}
                                            <span className={`absolute left-1/2 -translate-x-1/2 top-5 px-1.5 py-0.5 text-[9px] font-medium rounded whitespace-nowrap pointer-events-none ${isOOB ? 'bg-red-700 text-white font-bold shadow-md' : 'bg-gray-900/80 text-white'}`}>
                                                {n.name} {isOOB ? '⚠️ OUTSIDE' : ''}
                                            </span>
                                        </div>
                                    );
                                })}

                                {/* Draft Footprint Corner Markers */}
                                {activeTab === 'footprint' && footprintPoints.map((p, i) => {
                                    const xPct = p.x != null ? (p.x <= 1.0 ? p.x * 100 : p.x) : 0;
                                    const yPct = p.y != null ? (p.y <= 1.0 ? p.y * 100 : p.y) : 0;
                                    return (
                                        <div
                                            key={`footprint_marker_${i}`}
                                            style={{ left: `${xPct}%`, top: `${yPct}%` }}
                                            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                                        >
                                            <div className="w-5.5 h-5.5 rounded-full bg-purple-700 border-2 border-white text-white font-bold text-[10px] flex items-center justify-center shadow-md">
                                                F{i + 1}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Boundary Draft Corner Markers */}
                                {activeTab === 'boundaries' && polygonPoints.map((p, i) => {
                                    const xPct = p.x != null ? (p.x <= 1.0 ? p.x * 100 : p.x) : 0;
                                    const yPct = p.y != null ? (p.y <= 1.0 ? p.y * 100 : p.y) : 0;
                                    return (
                                        <div
                                            key={`poly_marker_${i}`}
                                            style={{ left: `${xPct}%`, top: `${yPct}%` }}
                                            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                                        >
                                            <div className={`w-5.5 h-5.5 rounded-full text-white font-bold text-[10px] flex items-center justify-center shadow-md transition-all ${p.is_manually_corrected
                                                    ? 'bg-purple-600 border-2 border-amber-300 ring-2 ring-purple-400 scale-110'
                                                    : 'bg-amber-500 border-2 border-white'
                                                }`}>
                                                {i + 1}
                                            </div>
                                            {p.is_manually_corrected && (
                                                <span className="absolute left-1/2 -translate-x-1/2 top-6 px-1.5 py-0.2 bg-purple-900/90 text-purple-200 text-[8px] font-bold rounded shadow-xs whitespace-nowrap">
                                                    GPS LOCKED
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* WiFi Survey Points Markers */}
                                {activeTab === 'wifi-survey' && roomFingerprints.map((fp, i) => {
                                    const xPct = fp.x != null ? (fp.x <= 1.0 ? fp.x * 100 : fp.x) : 0;
                                    const yPct = fp.y != null ? (fp.y <= 1.0 ? fp.y * 100 : fp.y) : 0;
                                    return (
                                        <div
                                            key={`wifi_fp_${fp.id || i}`}
                                            style={{ left: `${xPct}%`, top: `${yPct}%` }}
                                            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                                        >
                                            <div className="w-6 h-6 rounded-full bg-cyan-500 border-2 border-slate-900 text-slate-900 font-extrabold text-[10px] flex items-center justify-center shadow-lg ring-2 ring-cyan-300">
                                                {i + 1}
                                            </div>
                                            <span className="absolute left-1/2 -translate-x-1/2 top-7 px-1.5 py-0.5 bg-slate-900/90 text-cyan-300 text-[9px] font-bold rounded shadow-md whitespace-nowrap">
                                                {fp.readings?.length || 0} APs
                                            </span>
                                        </div>
                                    );
                                })}
                                {activeTab === 'wifi-survey' && surveyClickCoord && (
                                    <div
                                        style={{ left: `${surveyClickCoord.x * 100}%`, top: `${surveyClickCoord.y * 100}%` }}
                                        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                                    >
                                        <div className="w-7 h-7 rounded-full border-2 border-dashed border-amber-400 bg-amber-400/20 flex items-center justify-center">
                                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                        </div>
                                        <span className="absolute left-1/2 -translate-x-1/2 top-8 px-1.5 py-0.5 bg-amber-900 text-amber-200 text-[9px] font-bold rounded shadow-md whitespace-nowrap">
                                            Selected Point
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center p-8 text-gray-300 max-w-md mx-auto">
                                <Layers className="w-14 h-14 text-indigo-400 mx-auto mb-3 animate-pulse" />
                                <p className="font-bold text-base text-white">No Floor Plan Image Uploaded</p>
                                <p className="text-xs text-gray-400 mt-1 mb-6">
                                    {activeFloorPlan ? `Floor Plan "${activeFloorPlan.name}" (Floor ${activeFloorPlan.floor_number}) currently has no image.` : 'Select or create a floor plan to upload a schematic image.'}
                                </p>

                                {activeFloorPlan && (
                                    <div className="space-y-3">
                                        <label className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all border border-indigo-500">
                                            <Upload className="w-4 h-4 mr-2" />
                                            {isUploadingImage ? 'Uploading Image...' : 'Upload Floor Plan Image (PNG/JPG)'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleDirectImageUpload}
                                                disabled={isUploadingImage}
                                            />
                                        </label>
                                        <p className="text-[11px] text-gray-400">Supported formats: PNG, JPG, WEBP, SVG</p>
                                    </div>
                                )}
                            </div>
                        )}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Modal to Add New Floor Plan */}
        {showNewFloorPlanModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Add New Floor Plan</h3>
                    <p className="text-xs text-gray-500 mb-4">Create a specific floor plan for any museum and floor, with its own schematic diagram.</p>

                    <form onSubmit={handleCreateFloorPlanSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Museum</label>
                            <select
                                value={newPlanMuseumId || selectedMuseumId}
                                onChange={e => setNewPlanMuseumId(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white"
                            >
                                {museums.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Floor Plan Name</label>
                            <input
                                type="text"
                                required
                                placeholder="e.g. 2nd Floor Gallery, West Wing"
                                value={newPlanName}
                                onChange={e => setNewPlanName(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Floor Number</label>
                            <input
                                type="number"
                                required
                                value={newPlanFloor}
                                onChange={e => setNewPlanFloor(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Floor Plan Image (Optional)</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={e => setNewPlanImageFile(e.target.files?.[0] || null)}
                                className="w-full border border-gray-300 rounded-lg p-2 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                            />
                            <p className="text-[11px] text-gray-400 mt-1">You can also upload or replace the schematic anytime after creating.</p>
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t">
                            <button
                                type="button"
                                onClick={() => { setShowNewFloorPlanModal(false); setNewPlanImageFile(null); }}
                                className="px-4 py-2 text-xs font-bold border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !newPlanName}
                                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {loading ? 'Creating & Uploading...' : 'Create Floor Plan'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {showValidationModal && validationReport && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 border border-gray-100">
                    <div className="flex justify-between items-center border-b pb-3">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-6 h-6 text-indigo-600" />
                            <h3 className="text-xl font-bold text-gray-900">Comprehensive Map Validation Report</h3>
                        </div>
                        <button onClick={() => setShowValidationModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className={`p-4 rounded-xl border ${validationReport.invalid_edges_count > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                            <div className="text-xs uppercase font-bold text-gray-500">Wall-Crossing Edges</div>
                            <div className="text-2xl font-black mt-1">
                                {validationReport.invalid_edges_count} / {validationReport.total_edges} Flagged
                            </div>
                        </div>
                        <div className={`p-4 rounded-xl border ${validationReport.out_of_boundary_nodes_count > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'}`}>
                            <div className="text-xs uppercase font-bold text-gray-500">Out-of-Boundary Nodes</div>
                            <div className="text-2xl font-black mt-1">
                                {validationReport.out_of_boundary_nodes_count} / {validationReport.total_nodes} Flagged
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
                            <span>Out-of-Boundary Nodes</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 font-mono">{validationReport.out_of_boundary_nodes_count}</span>
                        </h4>
                        {validationReport.out_of_boundary_nodes_count === 0 ? (
                            <div className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200 font-semibold">
                                ✓ All nodes are located inside the building footprint boundary.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                {validationReport.out_of_boundary_nodes.map((n, i) => (
                                    <div key={i} className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs flex justify-between items-center text-red-900">
                                        <div>
                                            <span className="font-bold">{n.node_name}</span>
                                            <span className="font-mono text-gray-600 ml-2">({n.x.toFixed(2)}, {n.y.toFixed(2)})</span>
                                            <div className="text-[10px] text-red-700 mt-0.5">{n.reason}</div>
                                        </div>
                                        <span className="bg-red-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">OUTSIDE</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-800 text-sm mb-2 flex items-center gap-2">
                            <span>Wall-Crossing Path Edges</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 font-mono">{validationReport.invalid_edges_count}</span>
                        </h4>
                        {validationReport.invalid_edges_count === 0 ? (
                            <div className="text-xs text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200 font-semibold">
                                ✓ All path edges respect room boundaries & doorway openings.
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                {validationReport.invalid_edges.map((e, i) => (
                                    <div key={i} className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs flex justify-between items-center text-red-900">
                                        <div>
                                            <span className="font-bold">{e.from_node_name} ↔ {e.to_node_name}</span>
                                            <div className="text-[10px] text-red-700 mt-0.5">{e.reason}</div>
                                        </div>
                                        <span className="bg-red-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">CROSSING</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="pt-2 flex justify-end">
                        <button onClick={() => setShowValidationModal(false)} className="px-5 py-2.5 bg-gray-900 text-white font-bold text-xs rounded-xl hover:bg-gray-800 shadow-md">
                            Close Report
                        </button>
                    </div>
                </div>
            </div>
        )}

        {showGeoreferenceModal && activeFloorPlan && (
            <GeoreferenceModal
                floorPlan={activeFloorPlan}
                museum={activeMuseum}
                isOpen={showGeoreferenceModal}
                onClose={() => setShowGeoreferenceModal(false)}
                onSave={handleGeoreferenceSave}
                onClear={handleGeoreferenceClear}
            />
        )}

        {showNewArtifactModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                        <div className="flex items-center gap-2">
                            <Package className="w-5 h-5 text-indigo-600" />
                            <div>
                                <h3 className="font-bold text-base text-slate-800">Register New Museum Object</h3>
                                <p className="text-[11px] text-slate-500">Adds object to museum catalog & links it to this floor plan</p>
                            </div>
                        </div>
                        <button onClick={() => setShowNewArtifactModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleCreateArtifactSubmit} className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Object Name *</label>
                            <input
                                type="text"
                                required
                                value={newArtifactForm.name}
                                onChange={e => setNewArtifactForm({ ...newArtifactForm, name: e.target.value })}
                                placeholder="e.g. 19th Century Telescope"
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Category (Optional)</label>
                            <input
                                type="text"
                                value={newArtifactForm.category || ''}
                                onChange={e => setNewArtifactForm({ ...newArtifactForm, category: e.target.value })}
                                placeholder="e.g. Sculpture, Painting, Artifact..."
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Description (Optional)</label>
                            <textarea
                                rows={3}
                                value={newArtifactForm.description}
                                onChange={e => setNewArtifactForm({ ...newArtifactForm, description: e.target.value })}
                                placeholder="Historical significance or visitor notes..."
                                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                            <button
                                type="button"
                                onClick={() => setShowNewArtifactModal(false)}
                                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isCreatingArtifact || !newArtifactForm.name.trim()}
                                className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:bg-gray-400 shadow-sm"
                            >
                                {isCreatingArtifact ? 'Registering & Syncing...' : 'Register & Select'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {showQrModal && activeQrForModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 border border-slate-100">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                        <div className="flex items-center gap-2">
                            <QrCode className="w-5 h-5 text-indigo-600" />
                            <h3 className="font-bold text-base text-slate-800">Physical QR Checkpoint</h3>
                        </div>
                        <button onClick={() => setShowQrModal(false)} className="text-slate-400 hover:text-slate-600 p-1">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl flex justify-center border border-slate-100 shadow-inner">
                        <QRCodeSVG value={activeQrForModal.qr_payload} size={200} level="H" includeMargin />
                    </div>
                    <div>
                        <p className="font-mono text-sm font-bold text-slate-900">{activeQrForModal.qr_payload}</p>
                        <p className="text-xs text-slate-500 mt-0.5">Floor Plan: {activeFloorPlan?.name}</p>
                    </div>
                    <div className="flex gap-2 justify-center pt-2">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm transition-all"
                        >
                            <Printer className="w-4 h-4" /> Print Checkpoint
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowQrModal(false)}
                            className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Add Entrance Node at Wall Modal */}
        {doorwayModalOpen && pendingDoorway && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
                                <DoorOpen className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-base">Add Entrance Node at Wall</h3>
                                <p className="text-xs text-gray-500">Cross-room paths require an Entrance node at this wall</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setDoorwayModalOpen(false); setPendingDoorway(null); }}
                            className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="space-y-3.5 text-xs">
                        {/* From Room info */}
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Selected Room</label>
                            <div className="font-bold text-sm text-indigo-700">
                                {rooms.find(r => r.id === selectedRoomId)?.name || 'Selected Room'}
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                                Wall Position: ({(pendingDoorway.snapX * 100).toFixed(1)}%, {(pendingDoorway.snapY * 100).toFixed(1)}%)
                            </div>
                        </div>

                        {/* Connecting Room picker */}
                        <div>
                            <label className="block font-bold text-gray-700 mb-1">
                                Connects To (Adjacent Room / Entrance)
                            </label>
                            <select
                                value={connectedRoomId}
                                onChange={(e) => {
                                    const newConnId = e.target.value;
                                    setConnectedRoomId(newConnId);
                                    const actRoom = rooms.find(r => r.id === selectedRoomId);
                                    const otherRoom = rooms.find(r => r.id === newConnId);
                                    const nameSuffix = otherRoom ? otherRoom.name : (newConnId === 'exterior' ? 'Exterior' : 'Entrance');
                                    setDoorwayName(`${actRoom?.name || 'Room'} ↔ ${nameSuffix}`);
                                }}
                                className="w-full border-gray-300 rounded-xl p-2.5 bg-white border text-sm font-semibold text-gray-800"
                            >
                                <option value="">-- Exterior / Main Hallway Entrance --</option>
                                {rooms.filter(r => r.id !== selectedRoomId).map(r => (
                                    <option key={r.id} value={r.id}>
                                        {r.name} {pendingDoorway.adjacentRoom?.id === r.id ? '★ (Auto-detected adjacent)' : ''}
                                    </option>
                                ))}
                            </select>
                            {pendingDoorway.adjacentRoom && (
                                <p className="text-[11px] text-sky-700 mt-1 flex items-center gap-1 font-medium">
                                    <Sparkles className="w-3.5 h-3.5" /> Auto-detected adjacent room: <strong>{pendingDoorway.adjacentRoom.name}</strong>
                                </p>
                            )}
                        </div>

                        {/* Doorway / Entrance Name */}
                        <div>
                            <label className="block font-bold text-gray-700 mb-1">Entrance Node Name</label>
                            <input
                                type="text"
                                value={doorwayName}
                                onChange={(e) => setDoorwayName(e.target.value)}
                                placeholder="e.g. room 2 ↔ room 4 Entrance"
                                className="w-full border-gray-300 rounded-xl p-2.5 border text-sm"
                            />
                        </div>

                        {/* Informational Guidance */}
                        <div className="bg-sky-50 border border-sky-200 p-3 rounded-xl space-y-1 text-sky-950">
                            <span className="font-bold block text-sky-900">
                                Entrance Node Checkpoint
                            </span>
                            <span className="text-[11px] text-sky-800 leading-snug block">
                                Places an Entrance node at this wall opening. Visitors and navigation paths can only cross into or out of this room through this entrance node.
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={() => { setDoorwayModalOpen(false); setPendingDoorway(null); }}
                            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmSaveDoorway}
                            disabled={loading}
                            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
                        >
                            {loading ? 'Saving...' : <><CheckCircle className="w-4 h-4" /> Add Entrance Node</>}
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
);
}
