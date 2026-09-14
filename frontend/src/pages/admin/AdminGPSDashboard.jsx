import React, { useState, useEffect, useRef } from 'react';
import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { getNodes } from '../../services/mapApi';
import { getMuseums } from '../../services/api';
import { Map, Navigation, Crosshair, AlertCircle, Building } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const libraries = ['places'];

const mapContainerStyle = {
    width: '100%',
    height: '600px',
    borderRadius: '0.75rem',
    border: '1px solid #e5e7eb'
};

const defaultCenter = {
    lat: 13.073226,
    lng: 80.257045
};

const mapOptions = {
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
    mapTypeId: 'hybrid'
};

export default function AdminGPSDashboard() {
    const { isLoaded, loadError } = useLoadScript({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries,
    });

    const [nodes, setNodes] = useState([]);
    const [userLoc, setUserLoc] = useState(null);
    const [gpsError, setGpsError] = useState('');
    const [activeInfoWindow, setActiveInfoWindow] = useState(null);
    const [museums, setMuseums] = useState([]);
    const [selectedMuseumId, setSelectedMuseumId] = useState('');
    
    // Default to Chennai Museum location initially, but we will fly to user location when found
    const [mapCenter, setMapCenter] = useState(defaultCenter);
    const [mapZoom, setMapZoom] = useState(18);
    const mapRef = useRef(null);

    useEffect(() => {
        const fetchNodes = async () => {
            try {
                const res = await getNodes();
                if (res.data) setNodes(res.data);
            } catch (err) {
                console.log('Error fetching nodes:', err);
            }
        };

        const fetchMuseums = async () => {
            try {
                const res = await getMuseums();
                if (res.data) {
                    setMuseums(res.data);
                    if (res.data.length > 0 && res.data[0].latitude && res.data[0].longitude) {
                        setMapCenter({ lat: Number(res.data[0].latitude), lng: Number(res.data[0].longitude) });
                        setSelectedMuseumId(res.data[0].id);
                    }
                }
            } catch (err) {
                console.log('Error fetching museums:', err);
            }
        };

        fetchNodes();
        fetchMuseums();

        let watchId;
        if ('geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const newLoc = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setUserLoc(newLoc);
                    setGpsError('');
                },
                (error) => {
                    setGpsError(error.message);
                },
                {
                    enableHighAccuracy: true,
                    maximumAge: 0,
                    timeout: 5000
                }
            );
        } else {
            setGpsError('Geolocation is not supported by your browser');
        }

        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, []);

    const recenterOnUser = () => {
        if (userLoc) {
            setMapCenter(userLoc);
            setMapZoom(20);
        }
    };

    const handleMuseumChange = (e) => {
        const id = e.target.value;
        setSelectedMuseumId(id);
        const museum = museums.find(m => m.id.toString() === id.toString());
        if (museum && museum.latitude && museum.longitude) {
            setMapCenter({ lat: Number(museum.latitude), lng: Number(museum.longitude) });
            setMapZoom(18);
        }
    };

    if (loadError) return <div className="text-red-500 font-medium p-6">Error loading Google Maps</div>;
    if (!isLoaded) return <div className="text-gray-500 font-medium animate-pulse p-6">Loading GPS Dashboard...</div>;

    return (
        <div className="max-w-7xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-200 mt-8">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 border-b pb-4">
                <div className="flex items-center">
                    <Navigation className="w-8 h-8 text-blue-600 mr-3" />
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Unified GPS & Map Dashboard</h2>
                        <p className="text-sm text-gray-500">View real-time GPS location alongside physical museum coordinates.</p>
                    </div>
                </div>
                
                <div className="mt-4 md:mt-0 flex gap-4">
                    <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-2 ${userLoc ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <span className="text-sm font-semibold text-blue-800">
                            {userLoc ? 'GPS Active' : 'Waiting for GPS...'}
                        </span>
                    </div>
                    <button 
                        onClick={recenterOnUser}
                        disabled={!userLoc}
                        className={`flex items-center justify-center px-4 py-2 rounded-lg text-white font-bold transition-all ${userLoc ? 'bg-indigo-600 hover:bg-indigo-700 shadow-md' : 'bg-gray-400 cursor-not-allowed'}`}
                    >
                        <Crosshair className="w-4 h-4 mr-2" />
                        Recenter GPS
                    </button>
                </div>
            </div>

            {gpsError && (
                <div className="p-4 mb-6 rounded-lg flex items-center bg-yellow-50 text-yellow-800 border border-yellow-200">
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Warning: {gpsError}
                </div>
            )}

            <div className="mb-6 bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                    <label className="block text-sm font-semibold text-indigo-900 mb-1 flex items-center">
                        <Building className="w-4 h-4 mr-2" />
                        Select Museum Region
                    </label>
                    <select 
                        className="w-full p-2 border border-indigo-200 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        value={selectedMuseumId}
                        onChange={handleMuseumChange}
                    >
                        <option value="">-- Default Location --</option>
                        {museums.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 text-sm text-indigo-800">
                    <p>Jump to a specific museum's geographic footprint to view its localized tracking nodes.</p>
                </div>
            </div>

            <div className="relative">
                <GoogleMap
                    mapContainerStyle={mapContainerStyle}
                    zoom={mapZoom}
                    center={mapCenter}
                    options={mapOptions}
                    onLoad={map => { mapRef.current = map; }}
                >
                    {/* Draw all existing nodes that have coordinates */}
                    {nodes.filter(n => n.latitude && n.longitude).map(n => (
                        <Marker
                            key={n.id}
                            position={{ lat: Number(n.latitude), lng: Number(n.longitude) }}
                            onClick={() => setActiveInfoWindow(n.id)}
                            icon={{
                                url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
                            }}
                        >
                            {activeInfoWindow === n.id && (
                                <InfoWindow onCloseClick={() => setActiveInfoWindow(null)}>
                                    <div className="p-1 font-sans">
                                        <strong className="block text-sm">{n.name}</strong>
                                        <span className="text-xs text-gray-500">{n.node_type} - Floor {n.floor}</span>
                                        <div className="text-xs mt-1 font-mono bg-gray-100 p-1 rounded">
                                            {Number(n.latitude).toFixed(6)}, {Number(n.longitude).toFixed(6)}
                                        </div>
                                    </div>
                                </InfoWindow>
                            )}
                        </Marker>
                    ))}

                    {/* Draw the user real-time location */}
                    {userLoc && (
                        <Marker
                            position={userLoc}
                            onClick={() => setActiveInfoWindow('user')}
                            icon={{ 
                                url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' 
                            }}
                            zIndex={999}
                        >
                            {activeInfoWindow === 'user' && (
                                <InfoWindow onCloseClick={() => setActiveInfoWindow(null)}>
                                    <div className="text-xs font-bold text-blue-600 p-1">
                                        Your Live Location
                                        <div className="font-mono text-[10px] mt-1 text-gray-600">
                                            {userLoc.lat.toFixed(6)}, {userLoc.lng.toFixed(6)}
                                        </div>
                                    </div>
                                </InfoWindow>
                            )}
                        </Marker>
                    )}
                </GoogleMap>
            </div>
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-2 flex items-center">
                        <Map className="w-4 h-4 mr-2" />
                        Mapped Coordinates
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">Total nodes with assigned GPS coordinates: <span className="font-bold text-indigo-600">{nodes.filter(n => n.latitude && n.longitude).length}</span></p>
                    <div className="max-h-40 overflow-y-auto bg-white rounded border border-gray-200">
                        <table className="min-w-full text-xs text-left">
                            <thead className="text-gray-500 uppercase bg-gray-100 sticky top-0">
                                <tr>
                                    <th className="px-2 py-2">Name</th>
                                    <th className="px-2 py-2">Type</th>
                                    <th className="px-2 py-2 text-right">Lat, Lng</th>
                                </tr>
                            </thead>
                            <tbody>
                                {nodes.filter(n => n.latitude && n.longitude).map(n => (
                                    <tr key={n.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => { setMapCenter({lat: Number(n.latitude), lng: Number(n.longitude)}); setMapZoom(20); setActiveInfoWindow(n.id); }}>
                                        <td className="px-2 py-2 font-medium">{n.name}</td>
                                        <td className="px-2 py-2 text-gray-500">{n.node_type}</td>
                                        <td className="px-2 py-2 text-right font-mono text-gray-400">{Number(n.latitude).toFixed(5)}, {Number(n.longitude).toFixed(5)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-gray-700 mb-2 flex items-center">
                        <Navigation className="w-4 h-4 mr-2" />
                        Live Device Telemetry
                    </h3>
                    <div className="space-y-4 mt-4">
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold">Current Latitude</p>
                            <p className="text-lg font-mono text-gray-900 bg-white p-2 border border-gray-200 rounded mt-1 shadow-inner">
                                {userLoc ? userLoc.lat.toFixed(6) : '---.------'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold">Current Longitude</p>
                            <p className="text-lg font-mono text-gray-900 bg-white p-2 border border-gray-200 rounded mt-1 shadow-inner">
                                {userLoc ? userLoc.lng.toFixed(6) : '---.------'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
