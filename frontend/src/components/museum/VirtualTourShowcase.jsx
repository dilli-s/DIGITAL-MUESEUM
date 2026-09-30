import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Compass, Footprints, Info, Map, Sparkles, Play, Eye, ArrowRight } from 'lucide-react';
import axios from 'axios';
import API_BASE_URL from '../../config/api';

const VirtualTourShowcase = ({ museumId, museumName }) => {
  const [tourNodes, setTourNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!museumId) return;
    axios.get(`${API_BASE_URL}/tour/museums/${museumId}/nodes`)
      .then(res => {
        setTourNodes(res.data.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [museumId]);

  const hasTour = tourNodes.length > 0;
  const startNode = tourNodes.find(n => n.is_start) || tourNodes[0];

  return (
    <section className="relative overflow-hidden rounded-3xl mb-14 border border-neutral-800 bg-gradient-to-br from-neutral-950 via-[#0d0d16] to-[#121124] text-white p-8 sm:p-12 shadow-2xl">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left column: Compelling description & CTA */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-5 w-fit shadow-sm">
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-400" />
            <span>Immersive 360° Virtual Walkthrough</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Step Inside the Museum in{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-purple-300 to-indigo-300">
              Full 360° Street View
            </span>
          </h2>

          <p className="text-neutral-300 text-base sm:text-lg mb-8 leading-relaxed max-w-xl">
            Explore {museumName || 'the museum'} from anywhere in the world. Walk through physical corridors, look around in high-definition 360° panoramas, and click interactive curatorial hotspots to inspect real artifacts.
          </p>

          {/* Interactive Feature Pills */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                <Footprints className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Walkway Chevrons</h4>
                <p className="text-[11px] text-neutral-400">Google Street View navigation</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <Info className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Artifact Hotspots</h4>
                <p className="text-[11px] text-neutral-400">In-place curatorial details</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Gyroscope Look</h4>
                <p className="text-[11px] text-neutral-400">Tilt & turn on mobile devices</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Map className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Interactive Map</h4>
                <p className="text-[11px] text-neutral-400">2D live position tracker</p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to={`/museum/${museumId}/tour${startNode ? `/${startNode.id}` : ''}`}
              className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-neutral-950 font-bold text-base hover:from-amber-300 hover:to-amber-500 transition-all duration-200 shadow-[0_0_25px_rgba(251,191,36,0.4)] hover:shadow-[0_0_35px_rgba(251,191,36,0.6)] hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>START 360° VIRTUAL TOUR</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              to={`/museum/${museumId}/map`}
              className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.15] text-neutral-200 font-semibold text-sm transition-colors"
            >
              <Map className="w-4 h-4 text-neutral-400" />
              <span>View 2D Floor Plan</span>
            </Link>
          </div>
        </div>

        {/* Right column: Interactive Visual Card */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <Link
            to={`/museum/${museumId}/tour${startNode ? `/${startNode.id}` : ''}`}
            className="group block w-full relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-neutral-900 cursor-pointer"
          >
            {/* Background Panorama Image or Atmosphere */}
            {startNode?.panorama_url ? (
              <img
                src={startNode.panorama_url}
                alt="360° Panorama Preview"
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-neutral-900 via-indigo-950 to-neutral-900 flex items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(#a78bfa_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
              </div>
            )}

            {/* Dark glass overlay with UI hotspots */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 flex flex-col justify-between p-5">
              {/* Top status bar */}
              <div className="flex justify-between items-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-semibold text-amber-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  360° LIVE EXPLORATION
                </span>
                <span className="text-[11px] text-neutral-300 bg-black/60 px-2.5 py-1 rounded-full border border-white/10">
                  {tourNodes.length} Waypoints
                </span>
              </div>

              {/* Center 360° sphere interactive icon */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/90 text-neutral-950 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.6)] group-hover:scale-110 transition-transform duration-300">
                  <Play className="w-7 h-7 fill-current ml-0.5" />
                </div>
                <span className="mt-3 text-xs font-bold tracking-wider text-white bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                  CLICK TO ENTER TOUR
                </span>
              </div>

              {/* Bottom floor marker mock */}
              <div className="flex justify-between items-end text-xs text-neutral-300">
                <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-lg border border-white/10 backdrop-blur-md">
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Interactive 4K Panoramas</span>
                </div>
                <div className="text-[11px] text-amber-400 font-semibold">
                  {startNode?.name || 'Main Entrance'}
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default VirtualTourShowcase;
