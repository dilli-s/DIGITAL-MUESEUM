import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { 
  MapPin, 
  Navigation, 
  Compass, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Eye, 
  Sparkles,
  SlidersHorizontal,
  Layers,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { getMuseums } from '../services/api';
import { getMediaUrl } from '../utils/media';

// Verified authentic real-world museum coordinate registry
const KNOWN_COORDINATES = {
  'National History Museum': { lat: 51.4967, lng: -0.1764, city: 'London', country: 'United Kingdom' },
  'Museum of Modern Art': { lat: 40.7614, lng: -73.9776, city: 'New York', country: 'United States' },
  'Louvre Museum': { lat: 48.8606, lng: 2.3376, city: 'Paris', country: 'France' },
  'Acropolis Museum': { lat: 37.9684, lng: 23.7285, city: 'Athens', country: 'Greece' },
  'National Museum of Natural History': { lat: 38.8913, lng: -77.0261, city: 'Washington D.C.', country: 'United States' },
  'Kyoto National Museum': { lat: 34.9901, lng: 135.7731, city: 'Kyoto', country: 'Japan' },
  'British Museum': { lat: 51.5194, lng: -0.1270, city: 'London', country: 'United Kingdom' },
  'Metropolitan Museum of Art': { lat: 40.7794, lng: -73.9632, city: 'New York', country: 'United States' },
  'Oriental Institute Museum': { lat: 41.7892, lng: -87.5976, city: 'Chicago', country: 'United States' },
  'National Museum of India': { lat: 28.6119, lng: 77.2193, city: 'New Delhi', country: 'India' },
  'National Museum': { lat: 28.6119, lng: 77.2193, city: 'New Delhi', country: 'India' },
  'Salar Jung Museum': { lat: 17.3713, lng: 78.4804, city: 'Hyderabad', country: 'India' },
  'Chhatrapati Shivaji Maharaj Vastu Sangrahalaya': { lat: 18.9269, lng: 72.8327, city: 'Mumbai', country: 'India' },
  'Indian Museum': { lat: 22.5579, lng: 88.3512, city: 'Kolkata', country: 'India' },
  'Vatican Museums': { lat: 41.9067, lng: 12.4534, city: 'Vatican City', country: 'Vatican' },
};

// Calculate Haversine distance in kilometers
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 10) / 10;
};

const RADIUS_OPTIONS = [
  { label: 'All Distances', value: 0 },
  { label: '< 50 km', value: 50 },
  { label: '< 250 km', value: 250 },
  { label: '< 1,000 km', value: 1000 },
  { label: '< 5,000 km', value: 5000 },
];

const NearbyMuseums = () => {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const userMarkerRef = useRef(null);

  const [allMuseums, setAllMuseums] = useState([]);
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  const [locationAddress, setLocationAddress] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [selectedMuseum, setSelectedMuseum] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRadius, setSelectedRadius] = useState(0);
  const [isLoadingMuseums, setIsLoadingMuseums] = useState(true);

  // 1. Fetch Museums from API
  useEffect(() => {
    setIsLoadingMuseums(true);
    getMuseums({ per_page: 50 })
      .then(res => {
        const raw = res.data || [];
        // Map authentic coordinates only
        const mapped = raw.map((m) => {
          let lat = m.latitude ?? m.lat;
          let lng = m.longitude ?? m.lng;

          // If not in database, attempt exact known institution lookup
          if (lat == null || lng == null) {
            const match = KNOWN_COORDINATES[m.name];
            if (match) {
              lat = match.lat;
              lng = match.lng;
            }
          }

          return {
            ...m,
            lat: lat != null ? parseFloat(lat) : null,
            lng: lng != null ? parseFloat(lng) : null,
          };
        });

        setAllMuseums(mapped);
      })
      .catch(err => {
        console.error("Failed to load museums:", err);
      })
      .finally(() => {
        setIsLoadingMuseums(false);
      });
  }, []);

  // 2. Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter = [0, 20]; // Global world view default

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors'
          }
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: initialCenter,
      zoom: 1.8,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 3. User Geolocation Handler
  const handleDetectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const coords = { lat: latitude, lng: longitude };
        setUserLocation(coords);
        setIsLocating(false);

        // Reverse geocode location for friendly name
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          if (data && data.address) {
            const city = data.address.city || data.address.town || data.address.village || data.address.state || 'Your Current City';
            const country = data.address.country || '';
            setLocationAddress(`${city}, ${country}`);
          }
        } catch {
          setLocationAddress(`${latitude.toFixed(3)}°N, ${longitude.toFixed(3)}°E`);
        }

        // Fly map to user
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({
            center: [longitude, latitude],
            zoom: 11,
            essential: true
          });

          // Add / Update User marker
          if (userMarkerRef.current) {
            userMarkerRef.current.remove();
          }

          const userEl = document.createElement('div');
          userEl.className = 'w-7 h-7 rounded-full bg-blue-600 border-4 border-white shadow-xl flex items-center justify-center relative';
          userEl.innerHTML = '<span class="absolute w-12 h-12 rounded-full bg-blue-400/40 animate-ping"></span><span class="w-2.5 h-2.5 rounded-full bg-white"></span>';

          userMarkerRef.current = new maplibregl.Marker({ element: userEl })
            .setLngLat([longitude, latitude])
            .addTo(mapInstanceRef.current);
        }
      },
      (err) => {
        console.warn("Geolocation denied or error:", err);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Automatically request GPS on mount
  useEffect(() => {
    handleDetectLocation();
  }, [handleDetectLocation]);

  // 4. Calculate Distances and Sort
  const processedMuseums = allMuseums.map((m) => {
    const dist = (userLocation && m.lat != null && m.lng != null)
      ? calculateDistance(userLocation.lat, userLocation.lng, m.lat, m.lng)
      : null;
    return {
      ...m,
      distanceKm: dist,
    };
  });

  // Filter based on search and radius
  const filteredMuseums = processedMuseums
    .filter(m => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.city && m.city.toLowerCase().includes(q)) ||
        (m.location && m.location.toLowerCase().includes(q));
      
      const matchRadius = selectedRadius === 0 || (m.distanceKm !== null && m.distanceKm <= selectedRadius);

      return matchSearch && matchRadius;
    })
    .sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return 0;
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });

  // 5. Render Museum Markers on Map
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const bounds = new maplibregl.LngLatBounds();
    let hasValidCoords = false;

    filteredMuseums.forEach(m => {
      if (m.lat == null || m.lng == null || isNaN(m.lat) || isNaN(m.lng)) return;

      hasValidCoords = true;
      bounds.extend([m.lng, m.lat]);

      const isSelected = selectedMuseum?.id === m.id;

      const el = document.createElement('div');
      el.className = `cursor-pointer transition-transform duration-200 ${isSelected ? 'scale-125 z-30' : 'hover:scale-110 z-10'}`;
      el.innerHTML = `
        <div class="px-2.5 py-1.5 rounded-full ${isSelected ? 'bg-[#8f6826] text-[#fff8ea] ring-4 ring-[#dfb758]/50' : 'bg-[#241a10] text-[#fff8ea] border-2 border-[#dfb758]'} shadow-lg flex items-center gap-1.5 text-xs font-bold whitespace-nowrap">
          <svg class="w-3.5 h-3.5 text-[#ffd875]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
          </svg>
          <span class="max-w-[120px] truncate">${m.name}</span>
        </div>
      `;

      el.addEventListener('click', () => {
        setSelectedMuseum(m);
        mapInstanceRef.current?.flyTo({
          center: [m.lng, m.lat],
          zoom: 12,
          essential: true
        });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([m.lng, m.lat])
        .addTo(mapInstanceRef.current);

      markersRef.current.push(marker);
    });

    // If user has not located GPS and we have valid museums, fit map bounds
    if (!userLocation && hasValidCoords && filteredMuseums.length > 0) {
      try {
        mapInstanceRef.current.fitBounds(bounds, { padding: 60, maxZoom: 5 });
      } catch (e) {
        // ignore bounds fit error if single point
      }
    }
  }, [filteredMuseums, selectedMuseum, userLocation]);

  const handleSelectMuseum = (m) => {
    setSelectedMuseum(m);
    if (mapInstanceRef.current && m.lat != null && m.lng != null) {
      mapInstanceRef.current.flyTo({
        center: [m.lng, m.lat],
        zoom: 13,
        essential: true
      });
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 sm:gap-8 pb-16">
      
      {/* Header Banner */}
      <section className="relative w-full rounded-3xl overflow-hidden border-2 border-[#dfd2be] shadow-xl bg-[#241a10] text-[#fdf8ee] p-6 sm:p-10">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 transition-transform duration-1000 scale-100"
          style={{ backgroundImage: `url('/images/hero_museum_hall.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1c140d]/95 via-[#1c140d]/85 to-[#1c140d]/90" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#8f6826]/40 border border-[#dfb758]/50 text-[#ffe29a] text-[10px] font-bold tracking-[0.2em] uppercase mb-3 shadow-sm backdrop-blur-md">
              <Compass className="w-3.5 h-3.5 text-[#ffe29a]" />
              GLOBAL CULTURAL RADAR & GEOLOCATION
            </div>
            <h1 className="font-['Cinzel'] font-extrabold text-2xl sm:text-4xl lg:text-5xl text-[#fffdfa] tracking-tight mb-2">
              Museums Near You
            </h1>
            <p className="font-['Cormorant_Garamond'] italic text-base sm:text-xl text-[#f3e3cb]">
              Discover historical institutions, calculate real-time proximity, and explore virtual galleries.
            </p>
          </div>

          {/* Location status badge & detect trigger */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-[#fdfbf7]/10 backdrop-blur-md p-3.5 rounded-2xl border border-[#dfd2be]/30">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#8f6826] text-[#fff8ea] flex items-center justify-center shadow-md">
                <MapPin className="w-5 h-5 text-[#ffe29a]" />
              </div>
              <div className="text-left">
                <span className="text-[10px] uppercase tracking-wider text-[#d4c4ac] block font-medium">Current Location</span>
                <span className="text-xs sm:text-sm font-bold text-[#fffdfa] truncate max-w-[200px] block">
                  {locationAddress || (userLocation ? 'Coordinates Located' : 'Location Not Set')}
                </span>
              </div>
            </div>

            <button
              onClick={handleDetectLocation}
              disabled={isLocating}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#8f6826] to-[#a87d32] hover:from-[#a87d32] hover:to-[#dfb758] text-[#fff8ea] text-xs font-bold tracking-wider uppercase flex items-center gap-2 transition-all shadow-md active:scale-95 disabled:opacity-60"
            >
              <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
              <span>{isLocating ? 'Locating...' : 'Refresh GPS'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Control Bar: Search & Radius Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-[#fdfbf7] p-4 sm:p-5 rounded-2xl border-2 border-[#dfd2be] shadow-sm">
        
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8f6826] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by museum name, city, or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-[#faf5eb] border border-[#dfd2be] focus:border-[#8f6826] focus:outline-none text-xs sm:text-sm text-[#241a10] placeholder-[#8a7660]"
          />
        </div>

        {/* Radius filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar pb-1 md:pb-0">
          <span className="text-[11px] font-bold text-[#735a3e] uppercase tracking-wider flex items-center gap-1 mr-1">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Radius:
          </span>
          {RADIUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSelectedRadius(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                selectedRadius === opt.value
                  ? 'bg-[#8f6826] text-[#fff8ea] border-[#8f6826] shadow-sm'
                  : 'bg-[#faf5eb] text-[#5a4836] border-[#dfd2be] hover:border-[#8f6826]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Interactive Map + List of Nearby Museums */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Interactive Map Container (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="relative w-full h-[450px] sm:h-[550px] lg:h-[620px] rounded-3xl overflow-hidden border-2 border-[#dfd2be] shadow-lg bg-[#ede3d1]">
            <div ref={mapContainerRef} className="w-full h-full" />
            
            {/* Overlay Map Badge */}
            <div className="absolute top-4 left-4 z-10 bg-[#fdfbf7]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#dfd2be] shadow-md flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              <span className="text-[11px] font-bold text-[#241a10] uppercase tracking-wider">
                {filteredMuseums.filter(m => m.lat != null && m.lng != null).length} Museums Marked
              </span>
            </div>
          </div>
        </div>

        {/* Right: Museum List Sorted by Distance (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4 h-full">
          <div className="flex items-center justify-between px-2">
            <h2 className="font-['Cinzel'] font-bold text-lg sm:text-xl text-[#241a10]">
              Nearest Institutions
            </h2>
            <span className="text-xs font-medium text-[#735a3e]">
              Sorted by Proximity
            </span>
          </div>

          <div className="flex flex-col gap-3.5 max-h-[620px] overflow-y-auto pr-1">
            {isLoadingMuseums ? (
              <div className="py-20 flex flex-col items-center justify-center text-[#735a3e]">
                <RefreshCw className="w-8 h-8 animate-spin text-[#8f6826] mb-2" />
                <p className="font-['Cinzel'] text-sm">Locating museum network...</p>
              </div>
            ) : filteredMuseums.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-[#fdfbf7] border-2 border-[#dfd2be] text-[#735a3e]">
                <MapPin className="w-10 h-10 text-[#8a7660] mx-auto mb-2 opacity-50" />
                <h3 className="font-['Cinzel'] font-bold text-base text-[#241a10]">No Museums in this Radius</h3>
                <p className="text-xs text-[#5f4d39] mt-1 mb-4">Try selecting "All Distances" or searching another city.</p>
                <button
                  onClick={() => { setSelectedRadius(0); setSearchQuery(''); }}
                  className="px-4 py-1.5 rounded-full bg-[#8f6826] text-[#fff8ea] text-xs font-bold uppercase tracking-wider"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredMuseums.map((museum) => {
                const isSelected = selectedMuseum?.id === museum.id;
                const imageSrc = museum.image ? (museum.image.startsWith('http') ? museum.image : getMediaUrl(museum.image)) : '/images/hero_museum_hall.jpg';

                return (
                  <div
                    key={museum.id}
                    onClick={() => handleSelectMuseum(museum)}
                    className={`p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer flex flex-col gap-3 ${
                      isSelected
                        ? 'bg-[#f5ebd8] border-[#8f6826] shadow-md ring-2 ring-[#8f6826]/20'
                        : 'bg-[#fdfbf7] border-[#dfd2be] hover:border-[#8f6826] hover:shadow-md'
                    }`}
                  >
                    <div className="flex gap-3.5">
                      {/* Photo Thumbnail */}
                      <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 relative border border-[#dfd2be] bg-[#ede3d1]">
                        <img
                          src={imageSrc}
                          alt={museum.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = '/images/hero_museum_hall.jpg'; }}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          {museum.distanceKm !== null ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#8f6826] bg-[#8f6826]/10 px-2 py-0.5 rounded-full border border-[#8f6826]/20">
                              <Navigation className="w-2.5 h-2.5" />
                              {museum.distanceKm < 1 ? 'Under 1 km' : `${museum.distanceKm.toLocaleString()} km away`}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-[#735a3e] bg-[#ede3d1] px-2 py-0.5 rounded-full">
                              Global Heritage
                            </span>
                          )}

                          <span className="text-[10px] text-[#735a3e] font-medium truncate">
                            {museum.location || 'Museum'}
                          </span>
                        </div>

                        <h3 className="font-['Cinzel'] font-bold text-sm sm:text-base text-[#241a10] truncate">
                          {museum.name}
                        </h3>

                        <p className="text-xs text-[#5f4d39] line-clamp-1 font-light mt-0.5">
                          {museum.description || 'Historic collections & interactive virtual walkthroughs.'}
                        </p>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#dfd2be]/60 gap-2">
                      {museum.lat != null && museum.lng != null ? (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${museum.lat},${museum.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#735a3e] hover:text-[#241a10] uppercase tracking-wider py-1 px-2.5 rounded-lg hover:bg-[#ede3d1] transition-colors"
                        >
                          <ExternalLink className="w-3 h-3 text-[#8f6826]" />
                          <span>Directions</span>
                        </a>
                      ) : <span />}

                      <div className="flex items-center gap-2">
                        <Link
                          to={`/museums/${museum.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8f6826] hover:text-[#241a10] uppercase tracking-wider py-1 px-2.5 rounded-lg hover:bg-[#ede3d1] transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Details</span>
                        </Link>

                        <Link
                          to={`/museum/${museum.id}/tour`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-[#8f6826] to-[#a87d32] text-[#fff8ea] text-[11px] font-bold uppercase tracking-wider shadow-xs hover:from-[#a87d32] hover:to-[#dfb758] transition-all"
                        >
                          <span>360° Tour</span>
                          <ArrowRight className="w-3.5 h-3.5 text-[#ffe29a]" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default NearbyMuseums;
