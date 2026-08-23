import React, { useState, useEffect } from 'react';
import { getAdminDashboard } from '../../services/api';
import { RefreshCw, Building2, Image as ImageIcon, BookOpen, Layers, Target, Activity as ActivityIcon, Users, FileText, Compass, BarChart } from 'lucide-react';
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
    { label: 'Museums', count: stats.museums, icon: Building2, link: '/admin/museums' },
    { label: 'Galleries', count: stats.galleries, icon: ImageIcon, link: '/admin/galleries' },
    { label: 'Collections', count: stats.collections, icon: Layers, link: '/admin/collections' },
    { label: 'Exhibitions', count: stats.exhibitions, icon: Compass, link: '/admin/exhibitions' },
    { label: 'Objects', count: stats.objects, icon: Target, link: '/admin/objects' },
    { label: 'Learning Resources', count: stats.learning, icon: BookOpen, link: '/admin/learning' },
    { label: 'Stories', count: stats.stories, icon: FileText, link: '/admin/stories' },
    { label: 'Activities', count: stats.activities, icon: ActivityIcon, link: '/admin/activities' },
    { label: 'Users', count: stats.users, icon: Users, link: '#' },
  ] : [];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200">
        <h2 className="font-bold text-lg mb-2">Error</h2>
        <p>{error}</p>
        <button onClick={fetchStats} className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded font-semibold hover:bg-red-200">Try Again</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">Admin Dashboard</h1>
        <div className="flex space-x-3">
          <Link to="/admin/analytics" className="px-4 py-2 bg-indigo-50 text-indigo-700 font-semibold rounded-lg hover:bg-indigo-100 flex items-center border border-indigo-200 shadow-sm">
            <BarChart className="w-5 h-5 mr-2" /> Analytics & Health
          </Link>
          <button onClick={fetchStats} className="p-2 text-neutral-500 hover:text-neutral-900 bg-white border border-neutral-200 rounded-lg shadow-sm">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link 
              key={idx} 
              to={card.link}
              className={`bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 hover:border-neutral-900 hover:shadow-md transition-all group ${card.link === '#' ? 'cursor-default pointer-events-none' : ''}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-neutral-100 rounded-xl group-hover:bg-neutral-900 group-hover:text-white transition-colors">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-neutral-900">{card.count}</span>
              </div>
              <h3 className="font-semibold text-neutral-600 group-hover:text-neutral-900">{card.label}</h3>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default AdminDashboard;
