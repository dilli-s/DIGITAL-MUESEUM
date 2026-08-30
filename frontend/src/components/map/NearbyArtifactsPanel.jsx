import React from 'react';

export default function NearbyArtifactsPanel({ artifacts = [], onArtifactClick }) {
    if (!artifacts || artifacts.length === 0) return null;

    return (
        <div className="absolute top-20 right-4 w-64 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 overflow-hidden z-40 max-h-[60vh] flex flex-col">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Nearby Artifacts</h4>
            </div>
            <div className="overflow-y-auto p-2 space-y-2">
                {artifacts.map(art => (
                    <div 
                        key={art.id} 
                        onClick={() => onArtifactClick(art)}
                        className="flex items-center p-2 rounded-lg hover:bg-blue-50 cursor-pointer transition-colors border border-transparent hover:border-blue-100"
                    >
                        {art.image_url ? (
                            <img src={art.image_url} alt={art.name} className="w-10 h-10 rounded object-cover mr-3 bg-gray-200" />
                        ) : (
                            <div className="w-10 h-10 rounded bg-amber-100 text-amber-600 flex items-center justify-center mr-3 font-bold text-lg">
                                {art.name.charAt(0)}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{art.name}</p>
                            <p className="text-xs text-blue-600 font-semibold mt-0.5">
                                {Math.round(art.distance_m)}m away
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
