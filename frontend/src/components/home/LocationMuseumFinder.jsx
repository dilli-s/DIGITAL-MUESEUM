import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useLoadScript, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { Link } from 'react-router-dom';
import { MapPin, Navigation, Search, X, Building2, ChevronRight, RefreshCw } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

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

// Fallback to OpenStreetMap Nominatim API if Google Geocoding is disabled/fails
const fallbackReverseGeocode = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
    const data = await res.json();
    if (data && data.address) {
      return data.address.city || data.address.town || data.address.village || data.address.county || data.address.state || 'Unknown location';
    }
  } catch (e) {
    console.warn("Nominatim reverse geocode failed:", e);
  }
  return 'Unknown location';
};

const fallbackGeocode = async (locationStr) => {
  try {
    // Try full string
    let res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationStr)}`);
    let data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: locationStr };
    }
    
    // If it's a long address, it might fail in Nominatim. Try to extract just the city/state (last two parts)
    const parts = locationStr.split(',').map(p => p.trim());
    if (parts.length > 2) {
      const shortened = parts.slice(-2).join(', ');
      res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(shortened)}`);
      data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: locationStr };
      }
    }
  } catch (e) {
    console.warn("Nominatim geocode failed:", e);
  }
  return null;
};

// Geocode a string location using Google Maps Geocoder, with fallback
const geocodeLocation = (location) => {
  return new Promise((resolve) => {
    if (!window.google) return resolve(fallbackGeocode(location));
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: location }, async (results, status) => {
      if (status === 'OK' && results[0]) {
        resolve({
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng(),
          name: results[0].address_components[0]?.long_name || location
        });
      } else {
        // Fallback if API disabled or failed
        resolve(await fallbackGeocode(location));
      }
    });
  });
};

// Reverse geocode lat/lng to a city name, with fallback
const reverseGeocode = (lat, lng) => {
  return new Promise((resolve) => {
    if (!window.google) return resolve(fallbackReverseGeocode(lat, lng));
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, async (results, status) => {
      if (status === 'OK' && results[0]) {
        const city = results[0].address_components.find(c => 
          c.types.includes('locality') || 
          c.types.includes('administrative_area_level_2') ||
          c.types.includes('administrative_area_level_1')
        );
        if (city) {
          resolve(city.long_name);
        } else {
          resolve(results[0].formatted_address.split(',')[0] || 'Unknown location');
        }
      } else {
        // Fallback if API disabled or failed
        resolve(await fallbackReverseGeocode(lat, lng));
      }
    });
  });
};

const LocationMuseumFinder = ({ allMuseums = [], initialLocation = null, initialSearch = '' }) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  const [locationName, setLocationName] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [nearbyMuseums, setNearbyMuseums] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [error, setError] = useState('');
  const [selectedMuseum, setSelectedMuseum] = useState(null);

  // Geocode all museums that have a location string
  const [geocodedMuseums, setGeocodedMuseums] = useState([]);
  
  const mapRef = useRef();
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (allMuseums.length === 0 || !isLoaded) return;
    
    // Geocode each museum's location to get lat/lng for map pins
    const geocodeMuseums = async () => {
      const results = [];
      for (const m of allMuseums) {
        // Use database coordinates if they exist
        if (m.latitude && m.longitude) {
          results.push({ ...m, lat: m.latitude, lng: m.longitude });
          continue;
        }

        if (!m.location) continue;
        const coords = await geocodeLocation(m.location);
        if (coords) {
          results.push({ ...m, lat: coords.lat, lng: coords.lng });
        }
        await new Promise(r => setTimeout(r, 100));
      }
      setGeocodedMuseums(results);
    };
    geocodeMuseums();
  }, [allMuseums, isLoaded]);

  // Auto-detect user's location immediately on mount
  useEffect(() => {
    if (isLoaded && !userLocation && !initialLocation && !initialSearch && !isLocating) {
      handleDetectLocation();
    }
  }, [isLoaded, initialLocation, initialSearch]);

  // Re-calculate when geocoded museums finish loading in the background
  useEffect(() => {
    if (userLocation && locationName && geocodedMuseums.length > 0) {
      findNearbyMuseums(userLocation.lat, userLocation.lng, locationName);
    }
  }, [geocodedMuseums, userLocation, locationName]);

  // Auto-trigger from hero location detection
  useEffect(() => {
    if (!initialLocation || !isLoaded) return;
    const { lat, lng } = initialLocation;
    setUserLocation({ lat, lng });
    setMapCenter({ lat, lng });
    setIsLocating(true);
    reverseGeocode(lat, lng).then((city) => {
      setLocationName(city);
      findNearbyMuseums(lat, lng, city);
      setShowMap(true);
      setIsLocating(false);
    });
  }, [initialLocation, isLoaded]);

  // Auto-trigger from hero search
  useEffect(() => {
    if (!initialSearch || !isLoaded) return;
    setSearchInput(initialSearch);
    setIsSearching(true);
    geocodeLocation(initialSearch).then((result) => {
      if (result) {
        setUserLocation({ lat: result.lat, lng: result.lng });
        setMapCenter({ lat: result.lat, lng: result.lng });
        setLocationName(result.name || initialSearch);
        findNearbyMuseums(result.lat, result.lng, initialSearch);
        setShowMap(true);
      } else {
        setError(`Could not find "${initialSearch}". Try a different city name.`);
      }
      setIsSearching(false);
    });
  }, [initialSearch, isLoaded]);

  const findNearbyMuseums = useCallback((lat, lng, cityName) => {
    // First try text match with city name
    const textMatches = allMuseums.filter(m =>
      m.location && cityName && cityName !== 'Unknown location' && m.location.toLowerCase().includes(cityName.toLowerCase().split(',')[0])
    );

    // Also find geocoded museums within ~200km using Haversine
    const R = 6371;
    const geoMatches = geocodedMuseums.filter(m => {
      const dLat = (m.lat - lat) * Math.PI / 180;
      const dLng = (m.lng - lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(lat * Math.PI/180) * Math.cos(m.lat * Math.PI/180) * Math.sin(dLng/2)**2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return dist <= 200;
    });

    // Merge unique results
    const merged = [...new Map([...textMatches, ...geoMatches].map(m => [m.id, m])).values()];
    setNearbyMuseums(merged);
  }, [allMuseums, geocodedMuseums]);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setError('');

    let bestAccuracy = Infinity;
    let bestCoords = null;
    let attempts = 0;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        attempts++;
        if (pos.coords.accuracy < bestAccuracy) {
          bestAccuracy = pos.coords.accuracy;
          bestCoords = pos.coords;
        }

        // If accuracy is good enough (<50m), or we tried 3 times, lock it in
        if (bestAccuracy <= 50 || attempts >= 3) {
          navigator.geolocation.clearWatch(watchId);
          const lat = bestCoords.latitude;
          const lng = bestCoords.longitude;
          setUserLocation({ lat, lng });
          setMapCenter({ lat, lng });
          const city = await reverseGeocode(lat, lng);
          setLocationName(city);
          findNearbyMuseums(lat, lng, city);
          setShowMap(true);
          setIsLocating(false);
        }
      },
      () => {
        if (attempts === 0) {
          setError('Unable to get your location. Please search manually.');
          setIsLocating(false);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Stop watching after 10 seconds if no good fix
    setTimeout(() => {
      navigator.geolocation.clearWatch(watchId);
      if (isLocating && bestCoords) {
        setIsLocating(false);
        // use what we got
      } else if (isLocating) {
        setIsLocating(false);
      }
    }, 10000);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setIsSearching(true);
    setError('');
    const result = await geocodeLocation(searchInput);
    if (result) {
      setUserLocation({ lat: result.lat, lng: result.lng });
      setMapCenter({ lat: result.lat, lng: result.lng });
      setLocationName(result.name || searchInput);
      findNearbyMuseums(result.lat, result.lng, searchInput);
      setShowMap(true);
    } else {
      setError(`Could not find "${searchInput}". Try a different city name.`);
    }
    setIsSearching(false);
  };

  const handleMapClick = async (e) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setUserLocation({ lat, lng });
    const city = await reverseGeocode(lat, lng);
    setLocationName(city);
    findNearbyMuseums(lat, lng, city);
  };

  const handleReset = () => {
    setUserLocation(null);
    setLocationName('');
    setNearbyMuseums([]);
    setShowMap(false);
    setSearchInput('');
    setError('');
    setSelectedMuseum(null);
  };

  if (loadError) return <div className="py-16 text-center text-red-500">Error loading Google Maps</div>;

  return (
    <section className="py-16">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Find Museums Near You</h2>
        <p className="mt-2 text-neutral-600">Detect your location or search a city to discover nearby museums.</p>
      </div>

      {/* Controls */}
      {!showMap ? (
        <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-2xl p-8 text-white">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-10 h-10 text-neutral-300" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Select Your Location</h3>
            <p className="text-neutral-400 mb-8">We'll show you museums in your city and surrounding area.</p>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <button
                onClick={handleDetectLocation}
                disabled={isLocating || !isLoaded}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white text-neutral-900 font-semibold rounded-lg hover:bg-neutral-100 transition-colors disabled:opacity-60"
              >
                <Navigation className="w-5 h-5" />
                {isLocating ? 'Detecting...' : 'Use My Location'}
              </button>

              <span className="self-center text-neutral-500 hidden sm:block">or</span>

              <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search a city..."
                  className="flex-1 px-4 py-3 rounded-lg bg-neutral-700 text-white placeholder-neutral-400 border border-neutral-600 focus:outline-none focus:border-white"
                />
                <button
                  type="submit"
                  disabled={isSearching || !isLoaded}
                  className="px-4 py-3 bg-neutral-600 rounded-lg hover:bg-neutral-500 transition-colors disabled:opacity-60"
                >
                  <Search className="w-5 h-5" />
                </button>
              </form>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Location Header */}
          <div className="flex items-center justify-between bg-neutral-50 border border-neutral-200 rounded-xl px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide">Selected Location</p>
                <p className="font-bold text-neutral-900 text-lg">{locationName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-neutral-600">{nearbyMuseums.length} museum{nearbyMuseums.length !== 1 ? 's' : ''} found</span>
              <button onClick={handleReset} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Map */}
          <div className="rounded-2xl overflow-hidden border border-neutral-200 shadow-sm relative" style={{ height: '400px' }}>
            {!isLoaded ? (
              <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                zoom={10}
                center={mapCenter}
                options={mapOptions}
                onClick={handleMapClick}
                onLoad={onMapLoad}
              >
                {/* User location marker */}
                {userLocation && (
                  <>
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
                    <Circle
                      center={userLocation}
                      radius={200000} // 200km
                      options={{ fillColor: '#a3a3a3', fillOpacity: 0.15, strokeColor: '#737373', strokeWeight: 1 }}
                    />
                  </>
                )}

                {/* Museum markers */}
                {geocodedMuseums.map(m => (
                  <Marker
                    key={m.id}
                    position={{ lat: m.lat, lng: m.lng }}
                    onClick={() => setSelectedMuseum(m)}
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
                    <div className="p-1">
                      <div className="font-bold">{selectedMuseum.name}</div>
                      <div className="text-xs text-gray-500 mb-2">{selectedMuseum.location}</div>
                      <Link to={`/museums/${selectedMuseum.id}`} className="text-xs text-blue-600 font-semibold hover:underline">View Museum →</Link>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            )}
          </div>
          <p className="text-xs text-neutral-400 text-center">💡 Click anywhere on the map to change your location. Map data © Google</p>

          {/* Nearby Museums Grid */}
          {nearbyMuseums.length > 0 ? (
            <div>
              <h3 className="text-xl font-bold text-neutral-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Museums Near {locationName}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {nearbyMuseums.map(museum => (
                  <Link
                    key={museum.id}
                    to={`/museums/${museum.id}`}
                    className="group bg-white rounded-xl border border-neutral-200 p-5 hover:border-neutral-900 hover:shadow-md transition-all flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center group-hover:bg-neutral-900 transition-colors">
                        <Building2 className="w-5 h-5 text-neutral-600 group-hover:text-white transition-colors" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
                    </div>
                    <h4 className="font-bold text-neutral-900 mb-1">{museum.name}</h4>
                    <p className="text-sm text-neutral-500 flex items-center gap-1 mb-2">
                      <MapPin className="w-3 h-3" />{museum.location}
                    </p>
                    {museum.description && (
                      <p className="text-xs text-neutral-600 line-clamp-2">{museum.description}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-neutral-50 rounded-xl border border-neutral-200 border-dashed">
              <Building2 className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <p className="font-semibold text-neutral-700 mb-1">No museums found near {locationName}</p>
              <p className="text-sm text-neutral-500">Try clicking a different location on the map or search another city.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default LocationMuseumFinder;
