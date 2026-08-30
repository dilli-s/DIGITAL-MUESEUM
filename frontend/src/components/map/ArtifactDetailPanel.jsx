import React from 'react';

export default function ArtifactDetailPanel({ artifact, routeData, onNavigate, onClose }) {
    if (!artifact) return null;

    return (
        <div className="absolute bottom-0 left-0 w-full bg-white rounded-t-2xl shadow-xl p-4 md:w-96 md:rounded-2xl md:bottom-4 md:left-4 z-50 transition-transform transform translate-y-0">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-bold text-gray-900">{artifact.name}</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            
            {artifact.image_url && (
                <img src={artifact.image_url} alt={artifact.name} className="w-full h-40 object-cover rounded-lg mb-3" />
            )}
            
            <p className="text-gray-600 text-sm mb-4 line-clamp-3">{artifact.description}</p>

            {routeData ? (
                <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-100">
                    <div className="flex justify-between text-sm text-blue-800 font-medium mb-2">
                        <span>{routeData.distance_m} meters</span>
                        <span>~{Math.ceil(routeData.estimated_time_s / 60)} min walk</span>
                    </div>
                    <ul className="text-xs text-blue-700 space-y-1 mt-2 border-t border-blue-200 pt-2 max-h-32 overflow-y-auto">
                        {routeData.instructions.map((inst, idx) => (
                            <li key={idx} className="flex items-center">
                                <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                                {inst}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : (
                <button 
                    onClick={() => onNavigate(artifact)}
                    className="w-full bg-blue-600 text-white font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Navigate Here
                </button>
            )}
        </div>
    );
}
