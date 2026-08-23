import React, { useState, useEffect } from 'react';
import { Bookmark as BookmarkIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getBookmarks, createBookmark, deleteBookmark } from '../../services/api';
import { useNavigate, useLocation } from 'react-router-dom';

const BookmarkButton = ({ contentType, contentId }) => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkId, setBookmarkId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchBookmarkStatus = async () => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await getBookmarks();
        if (res && res.data) {
          const found = res.data.find(b => b.content_type === contentType && b.content_id === Number(contentId));
          if (isMounted) {
            if (found) {
              setIsBookmarked(true);
              setBookmarkId(found.id);
            } else {
              setIsBookmarked(false);
              setBookmarkId(null);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch bookmarks", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    fetchBookmarkStatus();
    return () => { isMounted = false; };
  }, [isAuthenticated, contentType, contentId]);

  const toggleBookmark = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }
    
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      if (isBookmarked && bookmarkId) {
        await deleteBookmark(bookmarkId);
        setIsBookmarked(false);
        setBookmarkId(null);
      } else {
        const res = await createBookmark(contentType, Number(contentId));
        setIsBookmarked(true);
        if (res && res.data) {
          setBookmarkId(res.data.id);
        }
      }
    } catch (err) {
      console.error("Failed to toggle bookmark", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={toggleBookmark}
      disabled={isLoading}
      className={`inline-flex items-center justify-center p-3 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-900 ${
        isBookmarked
          ? 'bg-neutral-900 text-white hover:bg-neutral-800'
          : 'bg-white text-neutral-500 border border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900'
      } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      aria-label={isBookmarked ? 'Remove Bookmark' : 'Bookmark this page'}
    >
      <BookmarkIcon className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
    </button>
  );
};

export default BookmarkButton;
