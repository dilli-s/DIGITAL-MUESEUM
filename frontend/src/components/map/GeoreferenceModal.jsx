import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Plus, Trash2, X } from 'lucide-react';

export default function GeoreferenceModal({ isOpen, onClose, floorPlan, onSave, onClear }) {
    const [anchors, setAnchors] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!floorPlan) return;
        const initial = [];
        if (floorPlan.anchor_1_lat != null && floorPlan.anchor_1_lat !== '') {
            initial.push({
                map_x: floorPlan.anchor_1_x_px ?? 0.1,
                map_y: floorPlan.anchor_1_y_px ?? 0.1,
                latitude: String(floorPlan.anchor_1_lat ?? ''),
                longitude: String(floorPlan.anchor_1_lng ?? '')
            });
        }
        if (floorPlan.anchor_2_lat != null && floorPlan.anchor_2_lat !== '') {
            initial.push({
                map_x: floorPlan.anchor_2_x_px ?? 0.9,
                map_y: floorPlan.anchor_2_y_px ?? 0.9,
                latitude: String(floorPlan.anchor_2_lat ?? ''),
                longitude: String(floorPlan.anchor_2_lng ?? '')
            });
        }
        if (floorPlan.anchor_3_lat != null && floorPlan.anchor_3_lat !== '') {
            initial.push({
                map_x: floorPlan.anchor_3_x_px ?? 0.1,
                map_y: floorPlan.anchor_3_y_px ?? 0.9,
                latitude: String(floorPlan.anchor_3_lat ?? ''),
                longitude: String(floorPlan.anchor_3_lng ?? '')
            });
        }
        if (floorPlan.anchor_4_lat != null && floorPlan.anchor_4_lat !== '') {
            initial.push({
                map_x: floorPlan.anchor_4_x_px ?? 0.9,
                map_y: floorPlan.anchor_4_y_px ?? 0.1,
                latitude: String(floorPlan.anchor_4_lat ?? ''),
                longitude: String(floorPlan.anchor_4_lng ?? '')
            });
        }

        if (initial.length === 0) {
            initial.push(
                { map_x: 0.1, map_y: 0.1, latitude: '', longitude: '' },
                { map_x: 0.9, map_y: 0.9, latitude: '', longitude: '' }
            );
        }
        setAnchors(initial);
        setError('');
    }, [floorPlan, isOpen]);

    if (!isOpen) return null;

    const handleAddAnchor = () => {
        if (anchors.length >= 4) {
            setError("Maximum 4 anchors allowed.");
            return;
        }
        setAnchors([...anchors, { map_x: 0.5, map_y: 0.5, latitude: '', longitude: '' }]);
    };

    const handleRemoveAnchor = (idx) => {
        if (anchors.length <= 2) {
            setError("At least 2 anchors are required for georeferencing.");
            return;
        }
        setAnchors(anchors.filter((_, i) => i !== idx));
        setError('');
    };

    const handleChange = (idx, field, value) => {
        const newAnchors = [...anchors];
        newAnchors[idx] = { ...newAnchors[idx], [field]: value };
        setAnchors(newAnchors);
    };

    const handleUseGPS = (idx) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    handleChange(idx, 'latitude', pos.coords.latitude.toFixed(7));
                    handleChange(idx, 'longitude', pos.coords.longitude.toFixed(7));
                    setError('');
                },
                (err) => {
                    setError("Failed to get GPS location. " + err.message);
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        } else {
            setError("Geolocation not supported by this browser.");
        }
    };

    const validateAndSave = () => {
        if (anchors.length < 2) {
            setError("You need at least 2 anchors for georeferencing.");
            return;
        }
        const cleanedAnchors = [];
        for (let i = 0; i < anchors.length; i++) {
            const a = anchors[i];
            const mapX = parseFloat(a.map_x);
            const mapY = parseFloat(a.map_y);
            const lat = parseFloat(a.latitude);
            const lng = parseFloat(a.longitude);

            if (isNaN(mapX) || isNaN(mapY) || mapX < 0 || mapX > 1 || mapY < 0 || mapY > 1) {
                setError(`Anchor ${i + 1}: Map X and Y must be valid numbers between 0.0 and 1.0.`);
                return;
            }
            if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
                setError(`Anchor ${i + 1}: Please enter valid Latitude and Longitude values.`);
                return;
            }
            cleanedAnchors.push({ map_x: mapX, map_y: mapY, latitude: lat, longitude: lng });
        }
        setError('');
        onSave(cleanedAnchors);
    };

    const handleClear = () => {
        if (window.confirm('Remove all georeference anchors from this floor plan?')) {
            onClear();
        }
    };

    // Live scale calculation
    let liveScale = null;
    let liveDistance = null;
    let livePixelSpan = null;
    if (anchors.length >= 2) {
        const a1 = anchors[0];
        const a2 = anchors[1];
        const lat1 = parseFloat(a1.latitude);
        const lng1 = parseFloat(a1.longitude);
        const lat2 = parseFloat(a2.latitude);
        const lng2 = parseFloat(a2.longitude);
        const x1 = parseFloat(a1.map_x);
        const y1 = parseFloat(a1.map_y);
        const x2 = parseFloat(a2.map_x);
        const y2 = parseFloat(a2.map_y);

        if (!isNaN(lat1) && !isNaN(lng1) && !isNaN(lat2) && !isNaN(lng2) &&
            !isNaN(x1) && !isNaN(y1) && !isNaN(x2) && !isNaN(y2)) {
            const R = 6371000;
            const phi1 = lat1 * Math.PI / 180;
            const phi2 = lat2 * Math.PI / 180;
            const dphi = (lat2 - lat1) * Math.PI / 180;
            const dlam = (lng2 - lng1) * Math.PI / 180;
            const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlam / 2) ** 2;
            const distM = 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            const w = floorPlan?.width_px || 1000;
            const h = floorPlan?.height_px || 1000;
            const dxPx = (x2 - x1) * w;
            const dyPx = (y2 - y1) * h;
            const distPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);

            if (distPx > 0) {
                liveScale = (distM / distPx).toFixed(4);
                liveDistance = distM < 1000 ? `${distM.toFixed(1)} m` : `${(distM / 1000).toFixed(2)} km`;
                livePixelSpan = `${Math.round(distPx)} px`;
            }
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
                <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-indigo-600" />
                        <h2 className="text-lg font-bold text-slate-800">Georeference Map: {floorPlan?.name}</h2>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200/60 transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed bg-blue-50/80 border border-blue-200/60 p-3 rounded-xl">
                        Define 2 to 4 anchor points to convert map image coordinates (normalized 0.0 to 1.0) into real-world GPS Latitude and Longitude. 3+ points solve a 6-parameter affine matrix.
                    </p>

                    {liveScale && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-xl text-xs flex items-center justify-between">
                            <div>
                                <span className="font-bold">Estimated Scale: </span>
                                <span className="font-mono font-bold text-emerald-800">{liveScale} m/px</span>
                                <span className="text-emerald-700 ml-2">({liveDistance} over {livePixelSpan})</span>
                            </div>
                            <span className="bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded text-[10px] font-bold">
                                {anchors.length >= 3 ? '6-Param Affine' : 'Similarity'}
                            </span>
                        </div>
                    )}
                    
                    {error && (
                        <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                            <span>⚠️ {error}</span>
                        </div>
                    )}
                    
                    <div className="space-y-4">
                        {anchors.map((a, idx) => (
                            <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 hover:border-slate-300 transition-all space-y-3">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black">
                                            {idx + 1}
                                        </span>
                                        Anchor Point {idx + 1}
                                    </h4>
                                    {anchors.length > 2 && (
                                        <button onClick={() => handleRemoveAnchor(idx)} className="text-xs text-red-600 hover:text-red-800 font-semibold flex items-center gap-1">
                                            <Trash2 className="w-3.5 h-3.5" /> Remove
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Map X (0.0 – 1.0)</label>
                                        <input
                                            type="text"
                                            value={a.map_x ?? ''}
                                            onChange={e => handleChange(idx, 'map_x', e.target.value)}
                                            placeholder="e.g. 0.15"
                                            className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Map Y (0.0 – 1.0)</label>
                                        <input
                                            type="text"
                                            value={a.map_y ?? ''}
                                            onChange={e => handleChange(idx, 'map_y', e.target.value)}
                                            placeholder="e.g. 0.85"
                                            className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Latitude</label>
                                        <input
                                            type="text"
                                            value={a.latitude ?? ''}
                                            onChange={e => handleChange(idx, 'latitude', e.target.value)}
                                            placeholder="e.g. 12.971598"
                                            className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-600 mb-1">Longitude</label>
                                        <input
                                            type="text"
                                            value={a.longitude ?? ''}
                                            onChange={e => handleChange(idx, 'longitude', e.target.value)}
                                            placeholder="e.g. 77.594562"
                                            className="w-full border border-slate-300 rounded-lg p-2 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>

                                <div className="pt-1 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => handleUseGPS(idx)}
                                        className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100 font-semibold flex items-center gap-1.5 transition-all"
                                    >
                                        <Navigation className="w-3.5 h-3.5" /> Use My GPS Location
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {anchors.length < 4 && (
                        <button
                            type="button"
                            onClick={handleAddAnchor}
                            className="w-full py-2.5 border-2 border-dashed border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                            <Plus className="w-4 h-4" /> Add Anchor Point ({anchors.length}/4)
                        </button>
                    )}
                </div>
                
                <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
                    <button
                        onClick={handleClear}
                        className="mr-auto px-4 py-2 border border-red-200 rounded-xl text-xs font-bold text-red-700 hover:bg-red-50 transition-all"
                    >
                        Clear Anchors
                    </button>
                    <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all">
                        Cancel
                    </button>
                    <button onClick={validateAndSave} className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all">
                        Save Georeference
                    </button>
                </div>
            </div>
        </div>
    );
}

