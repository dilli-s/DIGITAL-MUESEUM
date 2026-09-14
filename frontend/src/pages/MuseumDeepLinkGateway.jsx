import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getMuseum, getMuseumDetails } from '../services/api';
import { Smartphone, Download, Compass, ArrowRight, ExternalLink } from 'lucide-react';

const MuseumDeepLinkGateway = () => {
  const { museumId } = useParams();
  const navigate = useNavigate();
  const [museum, setMuseum] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appAttempted, setAppAttempted] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await getMuseumDetails(museumId);
        if (isMounted) setMuseum(data);
      } catch (e) {
        console.error('Error fetching museum details:', e);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();

    // Auto-trigger custom app scheme if on mobile device
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      setAppAttempted(true);
      const appSchemeUrl = `vanalok://m/${museumId}`;
      window.location.href = appSchemeUrl;
    }

    return () => { isMounted = false; };
  }, [museumId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-md rounded-2xl border border-indigo-500/30 p-6 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/30 border border-indigo-400/50 flex items-center justify-center mx-auto text-indigo-400 shadow-inner">
          <Compass className="w-9 h-9 animate-pulse" />
        </div>

        <div>
          <span className="text-xs uppercase tracking-widest text-indigo-400 font-semibold">Vanalok Museum Experience</span>
          <h1 className="text-2xl font-bold mt-1 text-white">
            {isLoading ? 'Loading Museum...' : (museum?.name || 'Welcome to Museum')}
          </h1>
          <p className="text-sm text-slate-300 mt-2">
            {museum?.location || 'Turn-by-turn indoor wayfinding & artifact discoveries'}
          </p>
        </div>

        {appAttempted && (
          <div className="p-3 bg-indigo-900/40 rounded-xl border border-indigo-500/40 text-xs text-indigo-200 text-left">
            💡 Launching Vanalok app directly. If the app is already installed, it will open to this museum automatically.
          </div>
        )}

        <div className="space-y-3 pt-2">
          <a
            href={`vanalok://m/${museumId}`}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl flex items-center justify-center space-x-2 transition shadow-lg shadow-indigo-600/30"
          >
            <Smartphone className="w-5 h-5" />
            <span>Open in Vanalok App</span>
          </a>

          <a
            href="https://play.google.com/store/apps/details?id=com.vanalok.mobile"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 bg-slate-700/80 hover:bg-slate-700 text-slate-200 font-medium rounded-xl flex items-center justify-center space-x-2 border border-slate-600 transition"
          >
            <Download className="w-5 h-5 text-emerald-400" />
            <span>Install on Google Play / App Store</span>
          </a>

          <button
            onClick={() => navigate(`/museums/${museumId}`)}
            className="w-full py-2.5 px-4 text-xs text-slate-400 hover:text-white flex items-center justify-center space-x-1 transition"
          >
            <span>Continue in Web Browser</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MuseumDeepLinkGateway;
