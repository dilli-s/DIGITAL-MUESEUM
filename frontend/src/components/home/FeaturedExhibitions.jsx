import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getExhibitions, getMuseums } from '../../services/api';
import { Calendar, MapPin, ArrowRight, Navigation, Sparkles, RefreshCw, Compass } from 'lucide-react';
import { getMediaUrl } from '../../utils/media';

// Haversine Distance Formula in Kilometers
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// Helper to format exhibition date & calculate upcoming timing
const getExhibitionDateInfo = (exhibition) => {
  const startStr = exhibition.startDate || exhibition.start_date;
  const endStr = exhibition.endDate || exhibition.end_date;
  const now = new Date();

  if (startStr) {
    const startDate = new Date(startStr);
    const endDate = endStr ? new Date(endStr) : null;
    const diffDays = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));

    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const formattedStart = startDate.toLocaleDateString('en-US', options);
    const formattedEnd = endDate ? endDate.toLocaleDateString('en-US', options) : null;

    if (diffDays > 0) {
      return {
        badgeText: diffDays <= 30 ? `Opens in ${diffDays}d` : `Upcoming • ${formattedStart}`,
        dateRange: formattedEnd ? `${formattedStart} – ${formattedEnd}` : `Starting ${formattedStart}`,
        isUpcoming: true,
        daysUntil: diffDays,
        timestamp: startDate.getTime(),
      };
    } else if (endDate && endDate >= now) {
      return {
        badgeText: `Ongoing • Closes ${formattedEnd || 'Soon'}`,
        dateRange: `${formattedStart} – ${formattedEnd}`,
        isOngoing: true,
        daysUntil: 0,
        timestamp: startDate.getTime(),
      };
    } else {
      return {
        badgeText: exhibition.period || `Archive Exhibition`,
        dateRange: formattedStart + (formattedEnd ? ` – ${formattedEnd}` : ''),
        isPast: true,
        daysUntil: 9999,
        timestamp: startDate.getTime(),
      };
    }
  }

  return {
    badgeText: exhibition.period || 'Upcoming Exhibition',
    dateRange: exhibition.period || 'Upcoming Season',
    isUpcoming: true,
    daysUntil: 30,
    timestamp: Date.now() + 30 * 86400000,
  };
};

const FeaturedExhibitions = ({ userLocation = null }) => {
  const [exhibitions, setExhibitions] = useState([]);
  const [museums, setMuseums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userCoords, setUserCoords] = useState(userLocation);
  const [locating, setLocating] = useState(false);
  const [selectedRadius, setSelectedRadius] = useState(300); // Default 300 km

  // Synchronize when parent updates location
  useEffect(() => {
    if (userLocation && userLocation.lat && userLocation.lng) {
      setUserCoords(userLocation);
    }
  }, [userLocation]);

  // Attempt auto-geolocation if no coords provided
  useEffect(() => {
    if (!userCoords && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            name: 'Current Location',
          });
        },
        (err) => {
          console.log('Location detection skipped or unavailable:', err.message);
        },
        { timeout: 8000 }
      );
    }
  }, []);

  // Fetch exhibitions and museums
  useEffect(() => {
    Promise.all([
      getExhibitions({ per_page: 50 }),
      getMuseums({ per_page: 50 }),
    ])
      .then(([exhibitionsRes, museumsRes]) => {
        setExhibitions(exhibitionsRes.data || []);
        setMuseums(museumsRes.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching exhibitions data:', err);
        setLoading(false);
      });
  }, []);

  // Handler to manually request GPS location
  const handleDetectLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          name: 'Your GPS Location',
        });
        setLocating(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocating(false);
        alert('Could not access your location. Please check browser permissions.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Map museum details to exhibitions and calculate distance
  const exhibitionsWithDistanceAndDates = useMemo(() => {
    const museumMap = new Map(museums.map((m) => [m.id, m]));

    return exhibitions.map((exhibition) => {
      const museum = exhibition.museum || museumMap.get(exhibition.museumId || exhibition.museum_id);
      const lat = museum?.latitude ?? exhibition.museum_latitude;
      const lng = museum?.longitude ?? exhibition.museum_longitude;
      const museumName = museum?.name || exhibition.museum_name || 'Sanctuary Archive';
      const museumLocation = museum?.location || exhibition.museum_location || 'Heritage Gallery';

      let distance = null;
      if (userCoords && userCoords.lat && userCoords.lng && lat != null && lng != null) {
        distance = calculateDistanceKm(userCoords.lat, userCoords.lng, lat, lng);
      }

      const dateInfo = getExhibitionDateInfo(exhibition);

      return {
        ...exhibition,
        museum,
        museumName,
        museumLocation,
        latitude: lat,
        longitude: lng,
        distance,
        dateInfo,
      };
    });
  }, [exhibitions, museums, userCoords]);

  // Filter and sort exhibitions based on radius and nearest upcoming dates
  const { filteredExhibitions, isFallbackNearby } = useMemo(() => {
    let list = [...exhibitionsWithDistanceAndDates];

    // Priority sort: upcoming start dates soonest first, then ongoing, then distance
    list.sort((a, b) => {
      // First compare days until start (upcoming first)
      if (a.dateInfo.daysUntil !== b.dateInfo.daysUntil) {
        return a.dateInfo.daysUntil - b.dateInfo.daysUntil;
      }
      // If same timing, sort by nearest distance if available
      if (a.distance != null && b.distance != null) {
        return a.distance - b.distance;
      }
      return (a.dateInfo.timestamp || 0) - (b.dateInfo.timestamp || 0);
    });

    if (selectedRadius === 'all' || !userCoords) {
      return { filteredExhibitions: list.slice(0, 6), isFallbackNearby: false };
    }

    // Filter by radius in km
    const withinRadius = list.filter(
      (item) => item.distance != null && item.distance <= selectedRadius
    );

    if (withinRadius.length > 0) {
      return { filteredExhibitions: withinRadius.slice(0, 6), isFallbackNearby: false };
    }

    // Fallback: If no museums are strictly within 200-300km, show nearest available sorted by distance & upcoming
    const sortedByDistance = list.filter((item) => item.distance != null).sort((a, b) => a.distance - b.distance);
    return {
      filteredExhibitions: sortedByDistance.length > 0 ? sortedByDistance.slice(0, 6) : list.slice(0, 6),
      isFallbackNearby: true,
    };
  }, [exhibitionsWithDistanceAndDates, selectedRadius, userCoords]);

  if (!loading && exhibitions.length === 0) return null;

  return (
    <section className="py-10 sm:py-14 relative">
      {/* Header with Title & Location Proximity Controls */}
      <div className="flex flex-col md:flex-row justify-between md:items-end mb-8 gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-6 h-[1px] bg-[#c89b3c]" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#8f6826] font-['Cinzel']">
              Sanctuaries of Heritage • Near You
            </span>
            <span className="w-6 h-[1px] bg-[#c89b3c]" />
          </div>
          <h2 className="font-['Cinzel'] font-bold text-2xl sm:text-3xl text-[#231a12] tracking-tight flex items-center gap-2.5">
            Featured & Upcoming Exhibitions
          </h2>
          <p className="font-['Cormorant_Garamond'] italic text-base sm:text-lg text-[#6f5b45] mt-1 max-w-2xl">
            Explore curated upcoming salons and ongoing exhibits at museums within 200–300 km of your location
          </p>
        </div>

        {/* Proximity Radius Selector & GPS Detector */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          {/* Geolocation Button */}
          <button
            onClick={handleDetectLocation}
            disabled={locating}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold tracking-wider transition-all duration-300 shadow-xs ${
              userCoords
                ? 'bg-[#8f6826]/15 border-[#8f6826]/40 text-[#5c462e]'
                : 'bg-[#fbf7ee] border-[#bfae95] text-[#5c462e] hover:bg-[#35281b] hover:text-[#f7efe3]'
            }`}
            title="Detect GPS location for 200–300 km museum proximity"
          >
            {locating ? (
              <RefreshCw className="w-3.5 h-3.5 text-[#8f6826] animate-spin" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-[#8f6826]" />
            )}
            <span>{userCoords ? 'GPS Active' : 'Detect Location'}</span>
          </button>

          {/* Radius Filter Pills */}
          <div className="inline-flex rounded-full p-1 bg-[#ede2cf]/70 border border-[#d8c8b0]">
            {[
              { label: '200 km', value: 200 },
              { label: '300 km', value: 300 },
              { label: 'All', value: 'all' },
            ].map((pill) => (
              <button
                key={pill.value}
                onClick={() => setSelectedRadius(pill.value)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all duration-200 ${
                  selectedRadius === pill.value
                    ? 'bg-[#8f6826] text-[#fff8ea] shadow-xs'
                    : 'text-[#5c462e] hover:text-[#231a12]'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <Link
            to="/search?tab=exhibitions"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#bfae95] bg-[#fbf7ee] hover:bg-[#35281b] hover:border-[#35281b] text-[#5c462e] hover:text-[#f7efe3] text-xs font-semibold tracking-wider uppercase shadow-xs transition-all duration-300 group"
          >
            <span>All Salons</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#c89b3c] group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Proximity Notification Bar if Fallback is shown */}
      {isFallbackNearby && userCoords && (
        <div className="mb-6 p-3 rounded-xl bg-[#fbf7ee] border border-[#d8c8b0] text-xs text-[#6e5842] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#8f6826] flex-shrink-0" />
            <span>
              Showing the closest upcoming exhibitions to your location (sorted by nearest date & distance):
            </span>
          </div>
          <button
            onClick={() => setSelectedRadius('all')}
            className="underline font-semibold text-[#8f6826] hover:text-[#241a10] ml-2"
          >
            View All Distances
          </button>
        </div>
      )}

      {/* Exhibitions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredExhibitions.map((exhibition, idx) => {
          const imgSrc = exhibition.image
            ? exhibition.image.startsWith('http')
              ? exhibition.image
              : getMediaUrl(exhibition.image)
            : '/images/card_statue_bust.jpg';

          const museumLink = exhibition.museumId || exhibition.museum_id
            ? `/museums/${exhibition.museumId || exhibition.museum_id}`
            : `/search?tab=exhibitions`;

          return (
            <Link
              key={exhibition.id || idx}
              to={museumLink}
              className="group relative bg-[#fdfbf7] border-2 border-[#d8c8b0] hover:border-[#8f6826] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 flex flex-col justify-between text-left"
            >
              {/* Exhibition Image & Floating Badges */}
              <div className="h-52 relative overflow-hidden bg-[#241a10]">
                <img
                  src={imgSrc}
                  alt={exhibition.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1b140d]/85 via-[#1b140d]/20 to-transparent" />

                {/* Top-Left: Upcoming Date Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1b140c]/85 border border-[#c89b3c]/50 text-[#f7efe3] text-[10px] font-['Cinzel'] font-bold tracking-wider uppercase backdrop-blur-xs shadow-sm">
                  <Calendar className="w-3 h-3 text-[#e5c158]" />
                  <span>{exhibition.dateInfo.badgeText}</span>
                </div>

                {/* Top-Right: Distance Badge (200 - 300 km proximity) */}
                {exhibition.distance != null && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#8f6826]/90 border border-[#dfb758]/60 text-[#fff8ea] text-[10px] font-mono font-bold tracking-wider shadow-md">
                    <MapPin className="w-3 h-3 text-[#ffe6a4]" />
                    <span>{exhibition.distance} km away</span>
                  </div>
                )}

                {/* Bottom on Image: Museum Name & Location */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[#fdfbf7] text-xs font-semibold drop-shadow">
                  <div className="flex items-center gap-1.5 truncate max-w-[85%]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#c89b3c] flex-shrink-0" />
                    <span className="truncate font-['Cinzel'] text-[11px] text-[#f7efe3]">
                      {exhibition.museumName}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#dfb758] flex-shrink-0">
                    {exhibition.museumLocation.split(',')[0]}
                  </span>
                </div>
              </div>

              {/* Content Area */}
              <div className="p-5 flex flex-col justify-between flex-grow">
                <div>
                  {/* Exhibition Title */}
                  <h3 className="font-['Cinzel'] font-bold text-base sm:text-lg text-[#241a10] group-hover:text-[#8f6826] transition-colors leading-snug mb-1.5 line-clamp-1">
                    {exhibition.title}
                  </h3>

                  {/* Date Range Subtitle */}
                  <div className="flex items-center text-[11px] font-mono text-[#8f6826] font-medium mb-2.5">
                    <Calendar className="w-3 h-3 mr-1 text-[#c89b3c]" />
                    <span>{exhibition.dateInfo.dateRange}</span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[#5f4d39] font-normal leading-relaxed line-clamp-2">
                    {exhibition.description || exhibition.subtitle || 'Experience extraordinary artifacts, historical documents, and curated installations.'}
                  </p>
                </div>

                {/* Bottom Footer Accent */}
                <div className="mt-4 pt-3 border-t border-[#ede3d1] flex items-center justify-between text-xs font-semibold text-[#8f6826] group-hover:text-[#241a10] transition-colors">
                  <span className="font-['Cinzel'] tracking-wider uppercase text-[11px]">Explore Salon & Sanctuary</span>
                  <span className="text-[#c89b3c] font-bold group-hover:translate-x-1 transition-transform">&rarr;</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default FeaturedExhibitions;
