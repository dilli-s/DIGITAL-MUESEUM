import React, { useState } from 'react';

export default function ArtifactPlacementTool({ currentFloorPlanId, onPlace }) {
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [isActive, setIsActive] = useState(false);

    const handleSave = async (map_x, map_y) => {
        if (!name) return alert("Name is required");
        
        try {
            const res = await fetch('/api/artifacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    floor_plan_id: currentFloorPlanId,
                    name,
                    description: desc,
                    map_x,
                    map_y
                })
            });
            if (res.ok) {
                setName('');
                setDesc('');
                setIsActive(false);
                onPlace && onPlace();
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <h3 className="text-lg font-bold mb-3">Place Artifact</h3>
            <div className="space-y-3">
                <input 
                    className="w-full border p-2 rounded text-sm" 
                    placeholder="Artifact Name" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                />
                <textarea 
                    className="w-full border p-2 rounded text-sm" 
                    placeholder="Description" 
                    value={desc} 
                    onChange={e => setDesc(e.target.value)} 
                />
                {!isActive ? (
                    <button 
                        onClick={() => setIsActive(true)}
                        className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 font-medium"
                    >
                        Activate Click-to-Place
                    </button>
                ) : (
                    <div className="bg-green-50 text-green-800 p-2 text-sm rounded border border-green-200 text-center animate-pulse">
                        Click on the map to place <b>{name || 'artifact'}</b>
                    </div>
                )}
            </div>
            
            {/* Expose a handler that a parent component can call when the map is clicked */}
            {isActive && (
                <div style={{ display: 'none' }} id="artifact-placer-proxy" data-active="true" onClick={(e) => handleSave(e.detail.x, e.detail.y)}></div>
            )}
        </div>
    );
}
