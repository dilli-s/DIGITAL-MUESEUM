import React, { useState, useEffect } from 'react';
import { getBookmarks } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { RefreshCw, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';

const Favourites = () => {
  const { isAuthenticated } = useAuth();
  const [bookmarks, setBookmarks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBookmarks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getBookmarks();
      setBookmarks(res.data || []);
    } catch (err) {
      setError('Unable to load bookmarks.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchBookmarks();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) return null; // Handled by ProtectedRoute

  if (isLoading) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <RefreshCw className="w-8 h-8 text-neutral-900 animate-spin mb-4" />
        <p className="text-lg text-neutral-600 font-medium">Loading favourites...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full py-32 flex flex-col items-center justify-center">
        <LayoutDashboard className="w-16 h-16 text-red-500 mb-6" />
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">{error}</h2>
        <button onClick={fetchBookmarks} className="px-6 py-3 bg-neutral-900 text-white font-bold rounded-lg hover:bg-neutral-800 transition-colors">
          TRY AGAIN
        </button>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-neutral-900">My Favourites</h1>
      {bookmarks.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 text-center">
          <p className="text-neutral-600 mb-4">You haven't saved any items yet.</p>
          <Link to="/explore" className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors">
            Explore Content
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {bookmarks.map((b) => (
            <div key={b.id} className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 flex flex-col">
              <div className="uppercase text-xs font-bold text-neutral-500 tracking-wider mb-2">
                {b.content_type}
              </div>
              <h3 className="text-lg font-bold text-neutral-900 mb-4">
                Saved Item #{b.content_id}
              </h3>
              <div className="mt-auto">
                <Link 
                  to={b.content_type === 'object' ? `/objects/${b.content_id}` : '#'}
                  className="text-sm font-semibold text-neutral-900 hover:underline"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favourites;
