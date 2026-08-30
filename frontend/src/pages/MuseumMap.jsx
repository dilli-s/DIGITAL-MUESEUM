import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { getMuseums } from '../services/api';
import {
  MapPin, Building2, Navigation, QrCode,
  Layers, X, RefreshCw
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Libraries to load for Google Maps
const libraries = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 20.5937,
  lng: 78.9629 // Center of India
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

// Geocode a string location using Google Maps Geocoder
const geocodeLocation = (location) => {
  return new Promise((resolve, reject) => {
    if (!window.google) return resolve(null);
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: location }, (results, status) => {
      if (status === 'OK' && results[0]) {
        resolve({
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng(),
        });
      } else {
        resolve(null);
      }
    });
  });
};

const MuseumMap = () => {
  const routeState = useLocation().state;
  
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [museums, setMuseums] = useState([]);
  const [geocodedMuseums, setGeocodedMuseums] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMuseum, setSelectedMuseum] = useState(null);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapZoom, setMapZoom] = useState(5);
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  const mapRef = useRef();
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Load museums from API
  useEffect(() => {
    getMuseums({ per_page: 50 })
      .then(res => {
        setMuseums(res.data || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  // Geocode each museum's location once Maps is loaded
  useEffect(() => {
    if (museums.length === 0 || !isLoaded) return;
    setIsGeocoding(true);

    const geocodeAll = async () => {
      const results = [];
      for (const m of museums) {
        // If museum already has precise coordinates from database, use them immediately!
        if (m.latitude && m.longitude) {
          results.push({ ...m, lat: m.latitude, lng: m.longitude, geocoded: true });
          continue;
        }

        if (!m.location) { results.push({ ...m, geocoded: false }); continue; }
        const coords = await geocodeLocation(m.location);
        if (coords) {
          results.push({ ...m, lat: coords.lat, lng: coords.lng, geocoded: true });
        } else {
          results.push({ ...m, geocoded: false });
        }
        await new Promise(r => setTimeout(r, 100)); // slight delay
      }
      setGeocodedMuseums(results);
      setIsGeocoding(false);

      // If a museumId was passed via route state, pan to it
      if (routeState?.museumId) {
        const target = results.find(m => m.id === routeState.museumId && m.geocoded);
        if (target) {
          setMapCenter({ lat: target.lat, lng: target.lng });
          setMapZoom(14);
          setSelectedMuseum(target);
        }
      }
    };
    geocodeAll();
  }, [museums, isLoaded, routeState]);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    
    let bestAccuracy = Infinity;
    let bestCoords = null;
    let attempts = 0;

    const watchId = navigator.geolocation.watchPosition(
      pos => {
        attempts++;
        if (pos.coords.accuracy < bestAccuracy) {
          bestAccuracy = pos.coords.accuracy;
          bestCoords = pos.coords;
        }

        if (bestAccuracy <= 50 || attempts >= 3) {
          navigator.geolocation.clearWatch(watchId);
          const lat = bestCoords.latitude;
          const lng = bestCoords.longitude;
          setUserLocation({ lat, lng });
          setMapCenter({ lat, lng });
          setMapZoom(15);
          setIsLocating(false);
          if (mapRef.current) {
            mapRef.current.panTo({ lat, lng });
          }
        }
      },
      () => {
        if (attempts === 0) setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      if (isLocating) setIsLocating(false);
    }, 10000);
  };

  const flyToMuseum = (museum) => {
    if (!museum.geocoded) return;
    setSelectedMuseum(museum);
    setMapCenter({ lat: museum.lat, lng: museum.lng });
    setMapZoom(15);
    if (mapRef.current) {
      mapRef.current.panTo({ lat: museum.lat, lng: museum.lng });
    }
  };

  const mappedCount = geocodedMuseums.filter(m => m.geocoded).length;

  if (loadError) return <div className="p-8 text-center text-red-500">Error loading Google Maps</div>;

  return (
    <div className="w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Museum Map</h1>
          <p className="text-neutral-500 mt-1">
            {isGeocoding ? 'Locating museums on map...' : `${mappedCount} of ${museums.length} museums plotted`}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDetectLocation}
            disabled={isLocating || !isLoaded}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors text-sm font-semibold disabled:opacity-60"
          >
            <Navigation className="w-4 h-4" />
            {isLocating ? 'Locating...' : 'My Location'}
          </button>
          <Link
            to="/physical"
            className="flex items-center gap-2 px-4 py-2.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-700 text-sm font-semibold transition-colors"
          >
            ← Visit Guide
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        {/* Sidebar: Museum List */}
        <div className="order-2 lg:order-1">
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-neutral-200 bg-neutral-50">
              <h3 className="font-bold text-neutral-800 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Museums ({museums.length})
              </h3>
            </div>
            <div className="divide-y divide-neutral-100 max-h-[500px] lg:max-h-[580px] overflow-y-auto">
              {isLoading ? (
                <div className="p-6 text-center text-neutral-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading museums...
                </div>
              ) : museums.length === 0 ? (
                <div className="p-6 text-center text-neutral-400">No museums found.</div>
              ) : geocodedMuseums.map(museum => (
                <div
                  key={museum.id}
                  onClick={() => museum.geocoded && flyToMuseum(museum)}
                  className={`p-4 flex items-start gap-3 transition-colors ${
                    museum.geocoded ? 'cursor-pointer hover:bg-neutral-50' : 'opacity-50'
                  } ${selectedMuseum?.id === museum.id ? 'bg-neutral-50 border-l-4 border-neutral-900' : ''}`}
                >
                  <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    museum.geocoded ? 'bg-neutral-900' : 'bg-neutral-300'
                  }`}>
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-semibold text-neutral-900 text-sm truncate">{museum.name}</p>
                    {museum.location && (
                      <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{museum.location}</span>
                      </p>
                    )}
                    {!museum.geocoded && museum.location && (
                      <p className="text-xs text-amber-500 mt-0.5">Could not plot on map</p>
                    )}
                  </div>
                  {museum.geocoded && (
                    <MapPin className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="order-1 lg:order-2">
          <div className="relative rounded-2xl overflow-hidden border border-neutral-200 shadow-sm" style={{ height: '640px' }}>
            {isGeocoding && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-sm border border-neutral-200 rounded-full px-4 py-2 flex items-center gap-2 text-sm shadow-lg">
                <RefreshCw className="w-4 h-4 animate-spin text-neutral-500" />
                <span className="text-neutral-700 font-medium">Plotting museums on map…</span>
              </div>
            )}

            {!isLoaded ? (
              <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                zoom={mapZoom}
                center={mapCenter}
                options={mapOptions}
                onLoad={onMapLoad}
                onClick={(e) => {
                  if (e.latLng) {
                    const lat = e.latLng.lat();
                    const lng = e.latLng.lng();
                    setUserLocation({ lat, lng });
                  }
                }}
              >
                {/* User location marker */}
                {userLocation && (
                  <Marker 
                    position={userLocation}
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: 8,
                      fillColor: '#ef4444',
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 2,
                    }}
                  />
                )}

                {/* Museum markers */}
                {geocodedMuseums.filter(m => m.geocoded).map(museum => (
                  <Marker
                    key={museum.id}
                    position={{ lat: museum.lat, lng: museum.lng }}
                    onClick={() => setSelectedMuseum(museum)}
                    icon={{
                      path: window.google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                      scale: 6,
                      fillColor: '#171717',
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 2,
                    }}
                  />
                ))}

                {/* Info Window */}
                {selectedMuseum && (
                  <InfoWindow
                    position={{ lat: selectedMuseum.lat, lng: selectedMuseum.lng }}
                    onCloseClick={() => setSelectedMuseum(null)}
                    options={{ pixelOffset: new window.google.maps.Size(0, -20) }}
                  >
                    <div className="p-1 max-w-[240px]">
                      <h4 className="font-bold text-neutral-900 mb-1">{selectedMuseum.name}</h4>
                      {selectedMuseum.location && (
                        <p className="text-xs text-neutral-500 flex items-center gap-1 mb-2">
                          <MapPin className="w-3 h-3" /> {selectedMuseum.location}
                        </p>
                      )}
                      {selectedMuseum.description && (
                        <p className="text-xs text-neutral-600 mb-3 line-clamp-2">{selectedMuseum.description}</p>
                      )}
                      <div className="flex gap-2">
                        <a href={`/museums/${selectedMuseum.id}`} className="flex-1 text-center text-xs font-bold bg-neutral-900 text-white px-3 py-1.5 rounded-lg hover:bg-neutral-800">
                          Visit Guide
                        </a>
                        <a href="/" className="text-xs font-semibold border border-neutral-200 text-neutral-700 px-3 py-1.5 rounded-lg hover:bg-neutral-50 flex items-center gap-1">
                          <QrCode className="w-3 h-3" /> Scan
                        </a>
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            )}
          </div>
          <p className="text-xs text-neutral-400 text-center mt-2">
            Map data © Google
          </p>
        </div>
      </div>
    </div>
  );
};

export default MuseumMap;
