import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import Map, { Marker, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getMuseum, getGallery, getGalleries, getObjects } from '../services/api';
import { getNodes } from '../services/mapApi';
import ObjectCard from '../components/object/ObjectCard';
import ErrorBoundary from '../components/ErrorBoundary';
import { ChevronRight, ArrowLeft, ArrowRight, LayoutDashboard, RefreshCw, MapPin, CheckCircle, Navigation } from 'lucide-react';

const schematicMapStyle = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#f8fafc'
      }
    }
  ]
};

const getPolygonCentroid = (points) => {
  if (!points || points.length === 0) return null;
  let sumLat = 0, sumLng = 0;
  points.forEach(p => { sumLat += p.lat; sumLng += p.lng; });
  return { lat: sumLat / points.length, lng: sumLng / points.length };
};

const isPointInPolygon = (lat, lng, polygon) => {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].lat, yi = polygon[i].lng;
    let xj = polygon[j].lat, yj = polygon[j].lng;
    let intersect = ((yi > lng) !== (yj > lng)) &&
        (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const GalleryDetails = () => {
  const { museumId, galleryId } = useParams();

  const [museum, setMuseum] = useState(null);
  const [gallery, setGallery] = useState(null);
  const [galleryObjects, setGalleryObjects] = useState([]);
  const [museumGalleries, setMuseumGalleries] = useState([]);
  const [nodes, setNodes] = useState([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [mapViewState, setMapViewState] = useState({ latitude: 13.073226, longitude: 80.257045, zoom: 18 });

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    
    try {
      const [m, g, gs, objs, nds] = await Promise.all([
        getMuseum(museumId),
        getGallery(galleryId),
        getGalleries({ museum_id: museumId, per_page: 50 }),
        getObjects({ gallery_id: galleryId, per_page: 50 }),
        getNodes().catch(() => ({ data: [] }))
      ]);
      
      // Verify museum match
      if (String(g.museumId) !== String(museumId)) {
        setNotFound(true);
      } else {
        setMuseum(m);
        setGallery(g);
        setMuseumGalleries(gs.data || []);
        setGalleryObjects(objs.data || []);
        setNodes(nds.data || []);

        // Compute map center from room centroid or gallery position
        if (g.boundary_polygon && g.boundary_polygon.length >= 3) {
          const center = getPolygonCentroid(g.boundary_polygon);
          if (center) {
            setMapViewState(prev => ({ ...prev, latitude: center.lat, longitude: center.lng, zoom: 18.5 }));
          }
        } else if (m && m.latitude && m.longitude) {
          setMapViewState(prev => ({ ...prev, latitude: parseFloat(m.latitude), longitude: parseFloat(m.longitude), zoom: 18 }));
        }
      }
    } catch (err) {
      console.error(err);
      if (err.response && err.response.status === 404) {
        setNotFound(true);
      } else {
        setError("Unable to load gallery.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [museumId, galleryId]);

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
        <p className="text-lg text-neutral-600 font-medium">Loading gallery...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <LayoutDashboard className="w-16 h-16 text-red-500 mb-6" />
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">{error}</h2>
        <p className="text-neutral-500 mb-8 max-w-md text-center">There was a problem connecting to the database.</p>
        <button 
          onClick={fetchData}
          className="px-6 py-3 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition-colors"
        >
          TRY AGAIN
        </button>
      </div>
    );
  }

  if (notFound || !museum || !gallery) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <h1 className="text-3xl font-bold mb-4 text-neutral-900">Gallery Not Found</h1>
        <p className="text-neutral-600 mb-8 max-w-md">
          The gallery you are looking for could not be found in this museum.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link 
            to={`/museum/${museumId}/galleries`} 
            className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-50 transition-colors"
          >
            Back to Galleries
          </Link>
          <Link 
            to="/museums" 
            className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            Back to Museums
          </Link>
        </div>
      </div>
    );
  }

  const roomGeoJSON = useMemo(() => {
    if (!museumGalleries || museumGalleries.length === 0) return { type: 'FeatureCollection', features: [] };
    const features = museumGalleries
      .filter(g => g.boundary_polygon && g.boundary_polygon.length >= 3)
      .map(g => {
        const coords = g.boundary_polygon.map(p => [p.lng, p.lat]);
        coords.push(coords[0]);
        const isCurrent = String(g.id) === String(galleryId);
        return {
          type: 'Feature',
          properties: { id: g.id, name: g.name, isCurrent },
          geometry: {
            type: 'Polygon',
            coordinates: [coords]
          }
        };
      });
    return { type: 'FeatureCollection', features };
  }, [museumGalleries, galleryId]);

  // Gallery Navigation
  const currentIndex = museumGalleries.findIndex(g => String(g.id) === String(galleryId));
  const prevGallery = currentIndex > 0 ? museumGalleries[currentIndex - 1] : null;
  const nextGallery = currentIndex < museumGalleries.length - 1 ? museumGalleries[currentIndex + 1] : null;

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <nav className="flex text-sm text-neutral-500 mb-6" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2">
          <li className="inline-flex items-center">
            <Link to="/" className="hover:text-neutral-900 transition-colors">Home</Link>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRight className="w-4 h-4 mx-1" />
              <Link to={`/museums/${museumId}`} className="hover:text-neutral-900 transition-colors truncate max-w-[100px] sm:max-w-xs">{museum.name}</Link>
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRight className="w-4 h-4 mx-1" />
              <Link to={`/museum/${museumId}/galleries`} className="hover:text-neutral-900 transition-colors">Galleries</Link>
            </div>
          </li>
          <li>
            <div className="flex items-center">
              <ChevronRight className="w-4 h-4 mx-1" />
              <span className="text-neutral-900 font-medium truncate max-w-[150px] sm:max-w-xs">{gallery.name}</span>
            </div>
          </li>
        </ol>
      </nav>

      {/* Gallery Hero */}
      <section className="bg-neutral-900 text-white rounded-2xl p-8 sm:p-12 mb-12 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 min-h-[350px]">
        <div className="absolute inset-0 opacity-30 bg-gradient-to-tr from-neutral-800 to-black pointer-events-none"></div>
        <div className="relative z-10 md:w-2/3">
          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-4">
            {gallery.period || gallery.theme || 'Gallery'}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2">{gallery.name}</h1>
          <p className="text-lg text-neutral-300 mb-6">{museum.name}</p>
          <p className="text-lg text-neutral-400 max-w-2xl mb-8">
            {gallery.description}
          </p>
          <Link 
            to={`/museum/${museumId}/galleries`}
            className="inline-flex items-center justify-center rounded-md border border-neutral-600 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            BACK TO GALLERIES
          </Link>
        </div>
        <div className="hidden md:flex relative z-10 w-1/3 justify-center items-center">
           <LayoutDashboard className="w-32 h-32 text-neutral-700 opacity-50" />
        </div>
      </section>

      {/* Gallery Info & Description */}
      <div className="grid md:grid-cols-3 gap-12 mb-16">
        <div className="md:col-span-2">
          <h2 className="text-2xl font-bold text-neutral-900 mb-4">About This Gallery</h2>
          <p className="text-neutral-600 leading-relaxed text-lg">
            {gallery.description}
          </p>
        </div>
        <div className="bg-neutral-50 p-6 rounded-xl border border-neutral-200 self-start">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">Gallery Information</h3>
          <dl className="space-y-4 text-sm">
            {gallery.period && gallery.period !== 'Unknown' && (
              <div className="flex justify-between border-b border-neutral-200 pb-2">
                <dt className="text-neutral-500">Period</dt>
                <dd className="font-medium text-neutral-900">{gallery.period}</dd>
              </div>
            )}
            {gallery.theme && gallery.theme !== 'Uncategorized' && (
              <div className="flex justify-between border-b border-neutral-200 pb-2">
                <dt className="text-neutral-500">Theme</dt>
                <dd className="font-medium text-neutral-900">{gallery.theme}</dd>
              </div>
            )}
            <div className="flex justify-between border-b border-neutral-200 pb-2">
              <dt className="text-neutral-500">Object Count</dt>
              <dd className="font-medium text-neutral-900">{galleryObjects.length}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Requirement 1 & 2: Room Auto-Render Schematic View */}
      <section className="mb-16">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Floor Plan & Artifact Locations</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Auto-rendered room boundaries and exhibit placement (Tile-Free Schematic View)</p>
          </div>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Auto-Rendered from DB Coordinates
          </span>
        </div>

        <div className="relative w-full h-[400px] rounded-2xl border border-neutral-300 overflow-hidden shadow-sm bg-slate-50">
          <ErrorBoundary>
            <Map
              {...mapViewState}
              onMove={evt => setMapViewState(evt.viewState)}
              mapStyle={schematicMapStyle}
              style={{ width: '100%', height: '100%' }}
            >
              {/* Auto-Rendered Room Polygons */}
              {roomGeoJSON.features.length > 0 && (
                <Source id="gallery-rooms" type="geojson" data={roomGeoJSON}>
                  <Layer 
                    id="gallery-rooms-fill" 
                    type="fill" 
                    paint={{ 
                      'fill-color': ['case', ['get', 'isCurrent'], '#cbd5e1', '#e2e8f0'],
                      'fill-opacity': 0.8
                    }} 
                  />
                  <Layer 
                    id="gallery-rooms-line" 
                    type="line" 
                    paint={{ 
                      'line-color': ['case', ['get', 'isCurrent'], '#1e293b', '#475569'],
                      'line-width': ['case', ['get', 'isCurrent'], 2.5, 1.5]
                    }} 
                  />
                </Source>
              )}

              {/* Room Centroid Labels */}
              {museumGalleries
                .filter(g => g.boundary_polygon && g.boundary_polygon.length >= 3)
                .map(g => {
                  const center = getPolygonCentroid(g.boundary_polygon);
                  if (!center) return null;
                  const isCurrent = String(g.id) === String(galleryId);
                  return (
                    <Marker key={`room-label-${g.id}`} latitude={center.lat} longitude={center.lng} anchor="center">
                      <div className={`text-xs font-bold px-2 py-0.5 rounded border shadow-sm pointer-events-none whitespace-nowrap ${isCurrent ? 'bg-neutral-900 text-white border-neutral-900 ring-2 ring-neutral-400' : 'bg-white/90 text-slate-700 border-slate-300'}`}>
                        {g.name}
                      </div>
                    </Marker>
                  );
                })}

              {/* Entrance & Exit Markers */}
              {nodes
                .filter(n => n.latitude && n.longitude)
                .map(n => {
                  const nodeTypes = (n.node_type || '').split(',').map(s => s.trim());
                  if (nodeTypes.includes('entrance')) {
                    return (
                      <Marker key={`node-${n.id}`} latitude={parseFloat(n.latitude)} longitude={parseFloat(n.longitude)} anchor="center">
                        <div className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-md border border-white tracking-wide pointer-events-none">
                          ENTRANCE
                        </div>
                      </Marker>
                    );
                  }
                  if (nodeTypes.includes('exit')) {
                    return (
                      <Marker key={`node-${n.id}`} latitude={parseFloat(n.latitude)} longitude={parseFloat(n.longitude)} anchor="center">
                        <div className="bg-red-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-md border border-white tracking-wide pointer-events-none">
                          EXIT
                        </div>
                      </Marker>
                    );
                  }
                  return null;
                })}

              {/* Artifact Points Inside Room (Placed by precise Lat/Lng) */}
              {galleryObjects
                .filter(o => o.latitude !== null && o.latitude !== undefined && o.latitude !== '' &&
                             o.longitude !== null && o.longitude !== undefined && o.longitude !== '')
                .map(obj => (
                  <Marker key={`object-marker-${obj.id}`} latitude={parseFloat(obj.latitude)} longitude={parseFloat(obj.longitude)} anchor="center">
                    <div className="group relative flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-amber-600 border-2 border-white shadow-md flex items-center justify-center text-[10px] text-white font-bold cursor-pointer hover:scale-125 transition-transform">
                        <MapPin className="w-3 h-3 text-white" />
                      </div>
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-neutral-900 text-white text-[11px] font-semibold px-2 py-1 rounded shadow-lg whitespace-nowrap z-20 pointer-events-none">
                        {obj.name || obj.title}
                      </div>
                    </div>
                  </Marker>
                ))}
            </Map>
          </ErrorBoundary>
        </div>
      </section>

      {/* Object Preview */}
      <section className="mb-16">
        <div className="flex justify-between items-end mb-8">
          <h2 className="text-2xl font-bold text-neutral-900">Objects in This Gallery</h2>
          <span className="text-sm font-medium text-neutral-500 bg-neutral-100 px-3 py-1 rounded-full">
            {galleryObjects.length} Previews
          </span>
        </div>

        {galleryObjects.length > 0 ? (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {galleryObjects.slice(0, 6).map(object => (
                <ObjectCard key={object.id} objectData={object} />
              ))}
            </div>
            {galleryObjects.length > 6 && (
              <div className="text-center">
                <button disabled className="inline-flex justify-center rounded-md bg-neutral-100 px-6 py-3 text-sm font-semibold text-neutral-400 cursor-not-allowed">
                  View All Objects (Future Phase)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 bg-neutral-50 rounded-2xl border border-neutral-200 border-dashed">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">No objects available</h3>
            <p className="text-neutral-500">Objects for this gallery will be added later.</p>
          </div>
        )}
      </section>

      {/* Gallery Navigation */}
      <section className="py-8 border-t border-neutral-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        {prevGallery ? (
          <Link 
            to={`/museum/${museumId}/gallery/${prevGallery.id}`}
            className="inline-flex items-center text-sm font-semibold text-neutral-900 hover:underline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous Gallery
          </Link>
        ) : <div />}
        
        <Link 
          to={`/museums/${museumId}`}
          className="text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          Back to Museum Overview
        </Link>

        {nextGallery ? (
          <Link 
            to={`/museum/${museumId}/gallery/${nextGallery.id}`}
            className="inline-flex items-center text-sm font-semibold text-neutral-900 hover:underline"
          >
            Next Gallery
            <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        ) : <div />}
      </section>
    </div>
  );
};

export default GalleryDetails;
