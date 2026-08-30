import React, { useState, useEffect } from 'react';
import { getAdminDashboard } from '../../services/api';
import { RefreshCw, Building2, Image as ImageIcon, BookOpen, Layers, Target, Activity as ActivityIcon, Users, FileText, Compass, BarChart, ShieldAlert, Map } from 'lucide-react';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getAdminDashboard();
      setStats(res.data);
    } catch (err) {
      setError("Failed to load dashboard statistics.");
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = stats ? [
    { label: 'Museums', count: stats.museums, icon: Building2, link: '/admin/museums', color: 'from-blue-500 to-cyan-400' },
    { label: 'Galleries', count: stats.galleries, icon: ImageIcon, link: '/admin/galleries', color: 'from-purple-500 to-pink-500' },
    { label: 'Collections', count: stats.collections, icon: Layers, link: '/admin/collections', color: 'from-orange-500 to-amber-400' },
    { label: 'Exhibitions', count: stats.exhibitions, icon: Compass, link: '/admin/exhibitions', color: 'from-emerald-500 to-teal-400' },
    { label: 'Objects', count: stats.objects, icon: Target, link: '/admin/objects', color: 'from-rose-500 to-red-500' },
    { label: 'Learning', count: stats.learning, icon: BookOpen, link: '/admin/learning', color: 'from-indigo-500 to-blue-500' },
    { label: 'Map Editor', count: 'Map', icon: Map, link: '/admin/map-editor', color: 'from-emerald-600 to-green-500' },
    { label: 'Stories', count: stats.stories, icon: FileText, link: '/admin/stories', color: 'from-fuchsia-500 to-purple-500' },
    { label: 'Activities', count: stats.activities, icon: ActivityIcon, link: '/admin/activities', color: 'from-sky-500 to-cyan-300' },
    { label: 'Users', count: stats.users, icon: Users, link: '/admin/users', color: 'from-slate-500 to-slate-400' },
  ] : [];

  if (isLoading) {
    return (
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8 -mb-8 min-h-[calc(100vh-4rem)] bg-slate-950 flex items-center justify-center">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full border-t-2 border-indigo-500 animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-r-2 border-purple-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          <div className="absolute inset-4 rounded-full border-b-2 border-cyan-500 animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8 -mb-8 min-h-[calc(100vh-4rem)] bg-slate-950 flex items-center justify-center">
        <div className="bg-red-950/50 backdrop-blur-md border border-red-500/30 text-red-200 p-8 rounded-3xl max-w-md text-center">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="font-bold text-2xl mb-2 text-white">System Error</h2>
          <p className="mb-6 opacity-80">{error}</p>
          <button onClick={fetchStats} className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-500 transition-colors">Retry Connection</button>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8 -mb-8 min-h-[calc(100vh-4rem)] bg-slate-950 p-4 sm:p-8 lg:p-12 relative overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute top-40 -left-20 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-[30rem] h-[30rem] bg-indigo-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 bg-white/5 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-3xl shadow-2xl">
          <div>
            <div className="inline-flex items-center space-x-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-sm font-semibold mb-3 border border-indigo-500/30">
              <ShieldAlert className="w-4 h-4" />
              <span>Supreme Command Center</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-blue-200 tracking-tight">
              Platform Overview
            </h1>
            <p className="mt-2 text-slate-400 text-lg max-w-xl">
              Monitor and control all museum data across the entire global infrastructure in real-time.
            </p>
          </div>
          
          <div className="mt-6 md:mt-0 flex space-x-4">
            <Link to="/admin/analytics" className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold rounded-xl hover:from-indigo-500 hover:to-blue-500 transition-all shadow-lg shadow-indigo-500/30 flex items-center group">
              <BarChart className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" /> System Analytics
            </Link>
            <button onClick={fetchStats} className="p-3 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl shadow-lg transition-all" title="Refresh Data">
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {statCards.map((card, idx) => {
            const Icon = card.icon;
            // Map the colors dynamically. Tailwind handles these since they are full class names in the array.
            return (
              <Link 
                key={idx} 
                to={card.link}
                className={`group relative overflow-hidden bg-white/5 backdrop-blur-lg border border-white/10 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:bg-white/10 ${card.link === '#' ? 'cursor-default pointer-events-none' : ''}`}
              >
                {/* Glow Effect */}
                <div className={`absolute -inset-4 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300 blur-xl rounded-full`}></div>
                
                <div className="relative z-10 flex justify-between items-start">
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${card.color} shadow-lg text-white`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500 tracking-tighter">
                    {card.count}
                  </span>
                </div>
                
                <div className="relative z-10 mt-6 flex justify-between items-end">
                  <h3 className="text-xl font-bold text-slate-200 group-hover:text-white transition-colors">{card.label}</h3>
                  {card.link !== '#' && (
                    <span className="text-sm font-semibold text-indigo-400 group-hover:text-indigo-300 flex items-center">
                      Manage <span className="ml-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">→</span>
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
