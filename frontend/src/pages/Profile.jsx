import React, { useState, useEffect } from 'react';
import { getHistory, getRecommendations } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, LayoutDashboard, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const Profile = () => {
  const { user, isAuthenticated } = useAuth();
  const [history, setHistory] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecsLoading, setIsRecsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    setIsRecsLoading(true);
    setError(null);
    try {
      const res = await getHistory();
      setHistory(res.data || []);
    } catch (err) {
      setError('Unable to load history.');
    } finally {
      setIsLoading(false);
    }
    
    try {
      const recsRes = await getRecommendations(4);
      setRecommendations(recsRes.data || []);
    } catch (err) {
      console.error(err);
      // Don't fail the whole page if recs fail
    } finally {
      setIsRecsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
        <p className="text-lg text-neutral-600 font-medium">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <LayoutDashboard className="w-16 h-16 text-red-500 mb-6" />
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">{error}</h2>
        <button onClick={fetchHistory} className="px-6 py-3 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition-colors">
          TRY AGAIN
        </button>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-neutral-900">My Profile</h1>
      <p className="text-neutral-600 mb-8">Welcome back, {user?.name}</p>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6 text-neutral-900 border-b border-neutral-200 pb-2">Recent Activity</h2>
        {history.length === 0 ? (
          <p className="text-neutral-600">No recent activity found.</p>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-neutral-200 flex justify-between items-center">
                <div>
                  <span className="font-semibold text-neutral-900 capitalize">{item.action} </span>
                  <span className="text-neutral-600">{item.content_type} #{item.content_id}</span>
                </div>
                <span className="text-xs text-neutral-400">
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-6 border-b border-neutral-200 pb-2">
          <Sparkles className="w-6 h-6 text-neutral-900" />
          <h2 className="text-2xl font-bold text-neutral-900">Recommended for You</h2>
        </div>
        
        {isRecsLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-neutral-500 mr-2" />
            <span className="text-neutral-500 font-medium">Finding recommendations...</span>
          </div>
        ) : recommendations.length === 0 ? (
          <p className="text-neutral-600">Explore more museum content to get personalized recommendations.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recommendations.map((rec) => (
              <div key={`${rec.type}-${rec.id}`} className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 hover:border-neutral-900 transition-colors flex flex-col">
                <div className="uppercase text-xs font-bold text-neutral-500 tracking-wider mb-2">
                  {rec.type}
                </div>
                <h3 className="text-lg font-bold text-neutral-900 mb-2">{rec.title}</h3>
                <p className="text-sm text-neutral-600 mb-6 italic">{rec.reason}</p>
                <div className="mt-auto">
                  <Link 
                    to={`/objects/${rec.id}`}
                    className="inline-flex items-center justify-center rounded-md bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-200 transition-colors w-full"
                  >
                    Explore
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Profile;
