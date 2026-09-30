import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useLoadScript, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import { Link } from 'react-router-dom';
import { MapPin, Navigation, Search, X, Landmark, ChevronRight, RefreshCw } from 'lucide-react';

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
    let res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationStr)}`);
    let data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: locationStr };
    }
    
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
        resolve(await fallbackGeocode(location));
      }
    });
  });
};

const reverseGeocode = (lat, lng) => {
  return new Promise((resolve) => {
    if (!window.google) return resolve(fallbackReverseGeocode(lat, lng));
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, async (results, status) => {
      if (status === 'OK' && results[0]) {
        const comp = results[0].address_components;
        const city = comp.find(c => c.types.includes('locality'))?.long_name;
        const state = comp.find(c => c.types.includes('administrative_area_level_1'))?.long_name;
        resolve(city || state || results[0].formatted_address || 'Unknown location');
      } else {
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

  const [userLocation, setUserLocation] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchInput, setSearchInput] = useState(initialSearch || '');
  const [nearbyMuseums, setNearbyMuseums] = useState([]);
  const [geocodedMuseums, setGeocodedMuseums] = useState([]);
  const [selectedMuseum, setSelectedMuseum] = useState(null);
  const [error, setError] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  const mapRef = useRef(null);
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const geocodeAllMuseums = useCallback(async (museums) => {
    const geocoded = [];
    for (const museum of museums) {
      if (museum.location) {
        const result = await geocodeLocation(museum.location);
        if (result) {
          geocoded.push({
            ...museum,
            lat: result.lat,
            lng: result.lng
          });
        }
      }
    }
    setGeocodedMuseums(geocoded);
  }, []);

  useEffect(() => {
    if (allMuseums.length > 0) {
      geocodeAllMuseums(allMuseums);
    }
  }, [allMuseums, geocodeAllMuseums]);

  const findNearbyMuseums = useCallback((lat, lng, query) => {
    const nearby = [];
    allMuseums.forEach(museum => {
      const q = (query || '').toLowerCase().trim();
      const matchText = q && (
        (museum.name && museum.name.toLowerCase().includes(q)) ||
        (museum.location && museum.location.toLowerCase().includes(q)) ||
        (museum.description && museum.description.toLowerCase().includes(q))
      );

      const geo = geocodedMuseums.find(g => g.id === museum.id);
      let dist = null;
      if (geo && lat && lng) {
        dist = getDistanceFromLatLonInKm(lat, lng, geo.lat, geo.lng);
      }

      if (matchText || (dist !== null && dist < 200)) {
        nearby.push({ ...museum, distance: dist });
      }
    });

    nearby.sort((a, b) => {
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      return 0;
    });

    setNearbyMuseums(nearby);
  }, [allMuseums, geocodedMuseums]);

  useEffect(() => {
    if (initialLocation) {
      setUserLocation(initialLocation);
      setMapCenter(initialLocation);
      reverseGeocode(initialLocation.lat, initialLocation.lng).then(name => {
        setLocationName(name);
        findNearbyMuseums(initialLocation.lat, initialLocation.lng, name);
      });
      setShowMap(true);
    } else if (initialSearch) {
      setSearchInput(initialSearch);
      geocodeLocation(initialSearch).then(result => {
        if (result) {
          setUserLocation({ lat: result.lat, lng: result.lng });
          setMapCenter({ lat: result.lat, lng: result.lng });
          setLocationName(result.name || initialSearch);
          findNearbyMuseums(result.lat, result.lng, initialSearch);
          setShowMap(true);
        }
      });
    }
  }, [initialLocation, initialSearch, findNearbyMuseums]);

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg) => deg * (Math.PI / 180);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    setError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setMapCenter({ lat: latitude, lng: longitude });
        const name = await reverseGeocode(latitude, longitude);
        setLocationName(name);
        setIsLocating(false);
        setShowMap(true);
        findNearbyMuseums(latitude, longitude, name);
      },
      async () => {
        try {
          const res = await fetch('https://ipapi.co/json/');
          const data = await res.json();
          if (data.latitude && data.longitude) {
            const loc = { lat: data.latitude, lng: data.longitude };
            setUserLocation(loc);
            setMapCenter(loc);
            const name = data.city || data.region || 'your area';
            setLocationName(name);
            setShowMap(true);
            findNearbyMuseums(loc.lat, loc.lng, name);
          } else {
            setError('Could not detect location. Please search for a city.');
          }
        } catch {
          setError('Could not detect location. Please search for a city.');
        } finally {
          setIsLocating(false);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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

  if (loadError) return <div className="py-8 text-center text-red-600">Error loading Google Maps</div>;

  return (
    <section className="py-6 sm:py-8">
      <div className="mb-6">
        <h2 className="font-['Cinzel'] text-2xl sm:text-3xl font-bold tracking-tight text-[#241a10]">
          Find Museums Near You
        </h2>
        <p className="font-['Cormorant_Garamond'] italic text-base sm:text-lg text-[#6e5842] mt-0.5">
          Detect your current location or search any historical city worldwide
        </p>
      </div>

      {/* Controls */}
      {!showMap ? (
        <div className="bg-[#fbf7ee] rounded-2xl p-6 sm:p-10 border border-[#d8c8b0] shadow-md text-[#241a10]">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-16 h-16 bg-[#ede3d1] border border-[#d4c4ac] rounded-full flex items-center justify-center mx-auto mb-4 text-[#8f6826]">
              <MapPin className="w-8 h-8" />
            </div>
            <h3 className="font-['Cinzel'] text-xl sm:text-2xl font-bold mb-2 text-[#241a10]">Select Your Location</h3>
            <p className="text-xs sm:text-sm text-[#6e5842] mb-6">We will locate physical and virtual museums in your vicinity.</p>

            <div className="flex flex-col sm:flex-row gap-3 mb-4 max-w-xl mx-auto">
              <button
                onClick={handleDetectLocation}
                disabled={isLocating || !isLoaded}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-[#8f6826] text-[#fff8ea] font-semibold rounded-full hover:bg-[#a87d32] transition-colors disabled:opacity-60 text-xs sm:text-sm uppercase tracking-wider shadow"
              >
                <Navigation className="w-4 h-4" />
                {isLocating ? 'Detecting...' : 'Use My Location'}
              </button>

              <span className="self-center text-xs font-bold text-[#8a7660] uppercase hidden sm:block">or</span>

              <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search a city (e.g., Paris, Delhi)..."
                  className="flex-1 px-4 py-2.5 rounded-full bg-[#fdfbf7] text-[#241a10] placeholder-[#9c8a76] border border-[#d8c8b0] focus:outline-none focus:border-[#8f6826] text-xs sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={isSearching || !isLoaded}
                  className="px-4 py-2.5 bg-[#8f6826] text-[#fff8ea] rounded-full hover:bg-[#a87d32] transition-colors disabled:opacity-60 shadow"
                >
                  <Search className="w-4 h-4" />
                </button>
              </form>
            </div>

            {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Location Header */}
          <div className="flex items-center justify-between bg-[#fbf7ee] border border-[#d8c8b0] rounded-2xl px-6 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[#8f6826] rounded-full flex items-center justify-center text-[#fff8ea]">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#8a7660] uppercase tracking-wider">Selected Location</p>
                <p className="font-['Cinzel'] font-bold text-[#241a10] text-base sm:text-lg">{locationName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#6e5842]">{nearbyMuseums.length} museum{nearbyMuseums.length !== 1 ? 's' : ''} found</span>
              <button onClick={handleReset} className="p-1.5 text-[#8a7660] hover:text-[#241a10] hover:bg-[#ede3d1] rounded-full transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Map */}
          <div className="rounded-2xl overflow-hidden border border-[#d8c8b0] shadow-md relative" style={{ height: '380px' }}>
            {!isLoaded ? (
              <div className="w-full h-full flex items-center justify-center bg-[#ede3d1] text-[#6e5842]">
                <RefreshCw className="w-8 h-8 animate-spin text-[#8f6826]" />
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
                        fillColor: '#8f6826',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                      }}
                    />
                    <Circle
                      center={userLocation}
                      radius={200000}
                      options={{ fillColor: '#c89b3c', fillOpacity: 0.15, strokeColor: '#8f6826', strokeWeight: 1 }}
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
                      fillColor: '#241a10',
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
                    <div className="p-1 text-[#241a10]">
                      <div className="font-bold">{selectedMuseum.name}</div>
                      <div className="text-xs text-gray-600 mb-2">{selectedMuseum.location}</div>
                      <Link to={`/museums/${selectedMuseum.id}`} className="text-xs text-[#8f6826] font-bold hover:underline">View Museum →</Link>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            )}
          </div>
          <p className="text-xs text-[#7a644e] text-center italic font-['Cormorant_Garamond']">💡 Click anywhere on the map to change your location. Map data © Google</p>

          {/* Nearby Museums Grid */}
          {nearbyMuseums.length > 0 ? (
            <div>
              <h3 className="font-['Cinzel'] text-xl font-bold text-[#241a10] mb-4 flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#8f6826]" />
                Museums Near {locationName}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {nearbyMuseums.map(museum => (
                  <Link
                    key={museum.id}
                    to={`/museums/${museum.id}`}
                    className="group bg-[#fdfbf7] rounded-xl border border-[#d8c8b0] p-5 hover:border-[#8f6826] hover:shadow-lg transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-9 h-9 bg-[#ede3d1] rounded-lg flex items-center justify-center text-[#8f6826] group-hover:bg-[#8f6826] group-hover:text-[#fff8ea] transition-colors">
                          <Landmark className="w-4 h-4" />
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#8a7660] group-hover:text-[#8f6826] transition-colors" />
                      </div>
                      <h4 className="font-['Cinzel'] font-bold text-[#241a10] text-base mb-1">{museum.name}</h4>
                      <p className="text-xs text-[#6e5842] flex items-center gap-1 mb-2">
                        <MapPin className="w-3 h-3 text-[#8f6826]" />{museum.location}
                      </p>
                      {museum.description && (
                        <p className="text-xs text-[#523e2b] line-clamp-2 leading-relaxed font-light">{museum.description}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-[#fdfbf7] rounded-2xl border border-[#d8c8b0] border-dashed">
              <Landmark className="w-10 h-10 text-[#a89984] mx-auto mb-2" />
              <p className="font-['Cinzel'] font-bold text-[#241a10] mb-1">No museums found near {locationName}</p>
              <p className="text-xs text-[#6e5842]">Try clicking a different location on the map or search another city.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default LocationMuseumFinder;
