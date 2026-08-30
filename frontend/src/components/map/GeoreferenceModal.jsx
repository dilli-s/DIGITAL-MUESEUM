import React, { useState, useEffect } from 'react';

export default function GeoreferenceModal({ isOpen, onClose, floorPlan, initialAnchors = [], onSave }) {
    const [anchors, setAnchors] = useState(initialAnchors);
    const [error, setError] = useState('');

    useEffect(() => {
        setAnchors(initialAnchors);
    }, [initialAnchors, isOpen]);

    if (!isOpen) return null;

    const handleAddAnchor = () => {
        if (anchors.length >= 4) {
            setError("Maximum 4 anchors allowed.");
            return;
        }
        setAnchors([...anchors, { map_x: 0, map_y: 0, latitude: '', longitude: '' }]);
    };

    const handleRemoveAnchor = (idx) => {
        setAnchors(anchors.filter((_, i) => i !== idx));
    };

    const handleChange = (idx, field, value) => {
        const newAnchors = [...anchors];
        newAnchors[idx][field] = value;
        setAnchors(newAnchors);
    };

    const useGPS = (idx) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    handleChange(idx, 'latitude', pos.coords.latitude);
                    handleChange(idx, 'longitude', pos.coords.longitude);
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
            setError("You need at least 2 anchors (3-4 recommended for affine).");
            return;
        }
        for (let a of anchors) {
            if (a.map_x < 0 || a.map_x > 1 || a.map_y < 0 || a.map_y > 1) {
                setError("Map X and Y must be between 0.0 and 1.0 (normalized).");
                return;
            }
            if (!a.latitude || !a.longitude) {
                setError("Latitude and Longitude cannot be empty.");
                return;
            }
        }
        setError('');
        onSave(anchors);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800">Georeference Map: {floorPlan?.name}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">&times;</button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1">
                    <p className="text-sm text-gray-600 mb-4">
                        Define 3-4 anchor points to calculate the least-squares affine transformation from map coordinates (normalized 0.0 to 1.0) to real-world GPS coordinates.
                    </p>
                    
                    {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4 text-sm">{error}</div>}
                    
                    <div className="space-y-4">
                        {anchors.map((a, idx) => (
                            <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50 relative">
                                <button onClick={() => handleRemoveAnchor(idx)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-sm">Remove</button>
                                <h4 className="font-semibold text-gray-700 mb-2">Anchor {idx + 1}</h4>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Map X (0.0-1.0)</label>
                                        <input type="number" step="0.001" value={a.map_x} onChange={e => handleChange(idx, 'map_x', parseFloat(e.target.value))} className="w-full border rounded p-1.5 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Map Y (0.0-1.0)</label>
                                        <input type="number" step="0.001" value={a.map_y} onChange={e => handleChange(idx, 'map_y', parseFloat(e.target.value))} className="w-full border rounded p-1.5 text-sm" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                                        <input type="number" step="any" value={a.latitude} onChange={e => handleChange(idx, 'latitude', parseFloat(e.target.value))} className="w-full border rounded p-1.5 text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                                        <input type="number" step="any" value={a.longitude} onChange={e => handleChange(idx, 'longitude', parseFloat(e.target.value))} className="w-full border rounded p-1.5 text-sm" />
                                    </div>
                                </div>
                                <div className="mt-2 text-right">
                                    <button onClick={() => useGPS(idx)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">
                                        Use My GPS Location
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {anchors.length < 4 && (
                        <button onClick={handleAddAnchor} className="mt-4 text-blue-600 font-medium text-sm hover:underline">
                            + Add Anchor Point
                        </button>
                    )}
                </div>
                
                <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
                    <button onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button onClick={validateAndSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium">Save Georeference</button>
                </div>
            </div>
        </div>
    );
}
