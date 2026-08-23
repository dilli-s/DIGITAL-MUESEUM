import React, { useState, useEffect } from 'react';
import { 
  getAdminAnalyticsSummary, getAdminAnalyticsUsers, getAdminAnalyticsContent,
  getAdminAnalyticsPopularContent, getAdminAnalyticsBookmarks,
  getAdminAnalyticsLearning, getAdminAnalyticsActivities,
  getAdminAnalyticsTrends, getAdminHealth
} from '../../services/api';
import { BarChart3, Users, BookOpen, Heart, Activity as ActivityIcon, CheckCircle, Database, Server, RefreshCw } from 'lucide-react';

const AdminAnalytics = () => {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState(null);
  const [content, setContent] = useState(null);
  const [popularContent, setPopularContent] = useState(null);
  const [learning, setLearning] = useState(null);
  const [activities, setActivities] = useState(null);
  const [health, setHealth] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Load health and summary first as they are most important overview
      const [summaryRes, healthRes] = await Promise.all([
        getAdminAnalyticsSummary(),
        getAdminHealth()
      ]);
      setSummary(summaryRes.data);
      setHealth(healthRes.data);
      
      // Load details concurrently
      const [usersRes, contentRes, popRes, learnRes, actRes] = await Promise.all([
        getAdminAnalyticsUsers(),
        getAdminAnalyticsContent(),
        getAdminAnalyticsPopularContent(),
        getAdminAnalyticsLearning(),
        getAdminAnalyticsActivities()
      ]);
      
      setUsers(usersRes.data);
      setContent(contentRes.data);
      setPopularContent(popRes.data);
      setLearning(learnRes.data);
      setActivities(actRes.data);
    } catch (err) {
      console.error(err);
      setError("Analytics are temporarily unavailable.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64 flex-col">
        <RefreshCw className="w-8 h-8 text-neutral-400 animate-spin mb-4" />
        <p className="text-neutral-500">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-red-500 font-medium">
        {error}
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, colorClass }) => (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 flex items-center">
      <div className={`p-4 rounded-full mr-4 ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-neutral-500">{title}</p>
        <p className="text-2xl font-bold text-neutral-900">{value !== undefined ? value : '--'}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-neutral-900">Analytics & Health</h1>
        <button onClick={fetchAnalytics} className="flex items-center text-sm px-4 py-2 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200">
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </button>
      </div>

      {/* System Health */}
      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center text-neutral-800">
          <Server className="w-5 h-5 mr-2 text-indigo-500" /> System Health
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm font-medium text-neutral-500 mb-1">Application</p>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${health?.application === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-semibold capitalize">{health?.application || 'Unknown'}</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500 mb-1">Database</p>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${health?.database === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="font-semibold capitalize">{health?.database || 'Unknown'}</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500 mb-1">AI Service</p>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${health?.ai_service === 'configured' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <span className="font-semibold capitalize">{health?.ai_service || 'Unknown'}</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-500 mb-1">Environment</p>
            <p className="font-semibold capitalize">{health?.environment || 'Unknown'}</p>
          </div>
        </div>
      </section>

      {/* Overview Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Users" value={summary?.users} icon={Users} colorClass="bg-blue-100 text-blue-600" />
        <StatCard title="Total Objects" value={summary?.objects} icon={BarChart3} colorClass="bg-purple-100 text-purple-600" />
        <StatCard title="Learning Activities" value={summary?.activities} icon={BookOpen} colorClass="bg-green-100 text-green-600" />
        <StatCard title="Total Bookmarks" value={summary?.bookmarks} icon={Heart} colorClass="bg-rose-100 text-rose-600" />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Analytics */}
        <section className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center text-neutral-800">
            <Users className="w-5 h-5 mr-2 text-blue-500" /> User Engagement (30 Days)
          </h2>
          {users ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <span className="text-neutral-600">New Users</span>
                <span className="font-bold">{users.new_users}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-3">
                <span className="text-neutral-600">Active Users</span>
                <span className="font-bold">{users.active_users}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-3">
                <span className="text-neutral-600">Engaged in Learning</span>
                <span className="font-bold">{users.users_with_learning}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Completed Activities</span>
                <span className="font-bold">{users.users_completing_activities}</span>
              </div>
            </div>
          ) : (
            <p className="text-neutral-500 text-sm">No user data available.</p>
          )}
        </section>

        {/* Learning Analytics */}
        <section className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center text-neutral-800">
            <CheckCircle className="w-5 h-5 mr-2 text-green-500" /> Educational Performance
          </h2>
          {learning && activities ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <span className="text-neutral-600">Learning Completion Rate</span>
                <span className="font-bold text-green-600">{learning.completion_rate}%</span>
              </div>
              <div className="flex justify-between items-center border-b pb-3">
                <span className="text-neutral-600">Activity Completion Rate</span>
                <span className="font-bold text-green-600">{activities.completion_rate}%</span>
              </div>
              <div className="flex justify-between items-center border-b pb-3">
                <span className="text-neutral-600">Total Activities Attempted</span>
                <span className="font-bold">{activities.attempts}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600">Total Activities Completed</span>
                <span className="font-bold">{activities.completed_activities}</span>
              </div>
            </div>
          ) : (
            <p className="text-neutral-500 text-sm">No educational data available.</p>
          )}
        </section>
      </div>

      {/* Popular Content */}
      <section className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
        <h2 className="text-xl font-bold mb-6 flex items-center text-neutral-800">
          <BarChart3 className="w-5 h-5 mr-2 text-purple-500" /> Most Popular Objects
        </h2>
        {popularContent?.popular_objects && popularContent.popular_objects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Rank</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Views</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Bookmarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {popularContent.popular_objects.map((obj, idx) => (
                  <tr key={obj.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-500">#{idx + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-900">{obj.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-neutral-700">{obj.views}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-neutral-500">{obj.bookmarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-neutral-500 text-sm text-center py-4">No interaction data available for this period.</p>
        )}
      </section>

    </div>
  );
};

export default AdminAnalytics;
