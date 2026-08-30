import React, { useState } from 'react';
import { createQrLocation } from '../../services/mapApi';

export default function QRAssignmentTool({ nodes, currentFloorPlanId, onAssign }) {
    const [selectedNodeId, setSelectedNodeId] = useState('');
    const [qrPayload, setQrPayload] = useState('');
    const [qrImage, setQrImage] = useState(null);

    const handleAssign = async () => {
        if (!selectedNodeId || !qrPayload) return;
        
        try {
            const res = await createQrLocation({
                floor_plan_id: currentFloorPlanId,
                node_id: selectedNodeId,
                qr_payload: qrPayload
            });
            
            if (res) {
                // Generate QR preview using a public API for simplicity in this tool
                setQrImage(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrPayload)}`);
                onAssign && onAssign();
            }
        } catch (e) {
            console.error("Failed to assign QR", e);
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <h3 className="text-lg font-bold mb-4">Assign QR Code to Node</h3>
            
            <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Node</label>
                <select 
                    value={selectedNodeId} 
                    onChange={e => setSelectedNodeId(e.target.value)}
                    className="w-full border rounded p-2 text-sm"
                >
                    <option value="">-- Choose a node --</option>
                    {nodes.map(n => (
                        <option key={n.id} value={n.id}>{n.name || `Node ${n.id.substring(0,8)}`}</option>
                    ))}
                </select>
            </div>
            
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">QR Payload String</label>
                <input 
                    type="text" 
                    value={qrPayload} 
                    onChange={e => setQrPayload(e.target.value)} 
                    placeholder="e.g. MUSEUM_FLOOR1_ENTRANCE"
                    className="w-full border rounded p-2 text-sm"
                />
            </div>
            
            <button 
                onClick={handleAssign}
                className="w-full bg-indigo-600 text-white font-medium py-2 rounded-lg hover:bg-indigo-700"
            >
                Link & Generate QR
            </button>
            
            {qrImage && (
                <div className="mt-4 text-center border-t pt-4">
                    <p className="text-sm font-medium text-gray-600 mb-2">Printable QR Code</p>
                    <img src={qrImage} alt="QR Code" className="mx-auto border p-2 rounded bg-white shadow-sm" />
                </div>
            )}
        </div>
    );
}
