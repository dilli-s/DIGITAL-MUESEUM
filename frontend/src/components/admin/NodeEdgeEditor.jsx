import React, { useState } from 'react';

export default function NodeEdgeEditor({ currentFloorPlanId, onUpdate }) {
    const [mode, setMode] = useState('view'); // view, add_node, add_edge, delete
    const [nodeType, setNodeType] = useState('waypoint');
    
    // In a full implementation, this component would receive the click events from FloorPlanCanvas
    // and maintain state of the "first selected node" for edge creation.
    // We'll provide the UI controls here.
    
    return (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <h3 className="text-lg font-bold mb-3">Path Network Editor</h3>
            
            <div className="grid grid-cols-2 gap-2 mb-4">
                <button 
                    onClick={() => setMode('view')}
                    className={`p-2 text-sm rounded border font-medium ${mode === 'view' ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-50 text-gray-700'}`}
                >
                    View / Move
                </button>
                <button 
                    onClick={() => setMode('add_node')}
                    className={`p-2 text-sm rounded border font-medium ${mode === 'add_node' ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-50 text-gray-700'}`}
                >
                    + Node
                </button>
                <button 
                    onClick={() => setMode('add_edge')}
                    className={`p-2 text-sm rounded border font-medium ${mode === 'add_edge' ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-50 text-gray-700'}`}
                >
                    + Edge
                </button>
                <button 
                    onClick={() => setMode('delete')}
                    className={`p-2 text-sm rounded border font-medium ${mode === 'delete' ? 'bg-red-600 text-white border-red-700' : 'bg-gray-50 text-gray-700'}`}
                >
                    Delete
                </button>
            </div>
            
            {mode === 'add_node' && (
                <div className="mb-2 p-3 bg-blue-50 border border-blue-100 rounded text-sm">
                    <label className="block text-gray-700 font-medium mb-1">Node Type:</label>
                    <select 
                        value={nodeType} 
                        onChange={e => setNodeType(e.target.value)}
                        className="w-full border rounded p-1.5"
                    >
                        <option value="waypoint">Waypoint (Path)</option>
                        <option value="entrance">Entrance</option>
                        <option value="elevator">Elevator</option>
                        <option value="stairs">Stairs</option>
                        <option value="junction">Junction</option>
                    </select>
                    <p className="mt-2 text-blue-800 text-xs text-center">Click map to place node</p>
                </div>
            )}
            
            {mode === 'add_edge' && (
                <div className="mb-2 p-3 bg-blue-50 border border-blue-100 rounded text-sm text-blue-800 text-center">
                    Click two nodes sequentially to connect them with a walkable edge.
                </div>
            )}
            
            {mode === 'delete' && (
                <div className="mb-2 p-3 bg-red-50 border border-red-100 rounded text-sm text-red-800 text-center">
                    Click a node or edge to delete it.
                </div>
            )}
        </div>
    );
}
