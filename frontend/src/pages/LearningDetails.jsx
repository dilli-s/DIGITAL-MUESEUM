import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getLearningById, getObject, getLearningProgress, updateLearningProgress } from '../services/api';
import { ArrowLeft, Clock, BarChart, RefreshCw } from 'lucide-react';
import RelatedLearning from '../components/learning/RelatedLearning';
import { useAuth } from '../context/AuthContext';
import BookmarkButton from '../components/common/BookmarkButton';

const LearningDetails = () => {
  const { learningId } = useParams();
  const [completed, setCompleted] = useState(false);
  const [object, setObject] = useState(null);
  const { isAuthenticated } = useAuth();
  
  const [item, setItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    getLearningById(learningId)
      .then(res => {
        setItem(res);
        if (res.objectId) {
          getObject(res.objectId).then(setObject).catch(console.error);
        }
        
        if (isAuthenticated) {
          getLearningProgress(learningId).then(progressRes => {
            if (progressRes?.data?.status === 'completed') {
              setCompleted(true);
            }
          }).catch(console.error);
        }
      })
      .catch(err => {
        console.error(err);
        setError("Unable to load learning content.");
      })
      .finally(() => setIsLoading(false));
  }, [learningId, isAuthenticated]);

  const handleComplete = async () => {
    if (!isAuthenticated) {
      setCompleted(true); // Optimistic for local state if not logged in
      return;
    }
    
    setIsUpdating(true);
    try {
      await updateLearningProgress(learningId, 100);
      setCompleted(true);
    } catch (err) {
      console.error("Failed to update progress", err);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <RefreshCw className="w-8 h-8 animate-spin text-neutral-900" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <h1 className="text-3xl font-bold mb-4 text-neutral-900">{error || "Learning Resource Not Found"}</h1>
        {error && (
          <button 
            onClick={() => window.location.reload()}
            className="mb-8 px-6 py-2 bg-neutral-900 text-white rounded-md"
          >
            TRY AGAIN
          </button>
        )}
        <Link to="/learning" className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white">
          Back to Learning
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto">
      <nav className="flex justify-between items-center text-sm text-neutral-500 mb-8" aria-label="Breadcrumb">
        <Link to="/learning" className="hover:text-neutral-900 transition-colors flex items-center">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Learning
        </Link>
        <BookmarkButton contentType="learning" contentId={learningId} />
      </nav>

      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-4 mb-4 text-sm font-medium text-neutral-500">
          <span className="uppercase tracking-wider font-bold">{item.type}</span>
          {item.duration && <span className="flex items-center"><Clock className="w-4 h-4 mr-1" /> {item.duration}</span>}
          {item.difficulty && <span className="flex items-center"><BarChart className="w-4 h-4 mr-1" /> {item.difficulty}</span>}
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-6 leading-tight">{item.title}</h1>
        {item.description && <p className="text-xl text-neutral-600 max-w-2xl mx-auto">{item.description}</p>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 md:p-12 mb-16 text-lg text-neutral-800 leading-relaxed space-y-10">
        {item.content && item.content.map((section, idx) => (
          <section key={idx}>
            {section.heading && <h2 className="text-2xl font-bold text-neutral-900 mb-4">{section.heading}</h2>}
            {section.text && <p>{section.text}</p>}
          </section>
        ))}

        {!completed ? (
          <div className="pt-8 border-t border-neutral-200 text-center">
            <button 
              onClick={handleComplete}
              disabled={isUpdating}
              className={`inline-flex items-center justify-center rounded-md px-8 py-4 text-sm font-bold text-white transition-colors ${
                isUpdating ? 'bg-neutral-400 cursor-not-allowed' : 'bg-neutral-900 hover:bg-neutral-800'
              }`}
            >
              {isUpdating ? 'SAVING...' : 'MARK AS COMPLETE'}
            </button>
          </div>
        ) : (
          <div className="pt-8 border-t border-neutral-200 text-center bg-green-50 rounded-xl p-8 mt-8 border-green-200 border">
            <h3 className="text-xl font-bold text-green-800 mb-2">Learning Complete</h3>
            <p className="text-green-700">Great job completing this article!</p>
          </div>
        )}
      </div>

      {object && (
        <div className="mb-16 bg-neutral-900 text-white p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-bold mb-2">Related Object</h3>
            <p className="text-neutral-400">{object.name}</p>
          </div>
          <Link to={`/objects/${object.id}`} className="px-6 py-3 bg-white text-neutral-900 rounded-md font-semibold text-sm hover:bg-neutral-200">
            VIEW OBJECT
          </Link>
        </div>
      )}

      {object && <RelatedLearning objectId={object.id} />}
    </div>
  );
};

export default LearningDetails;
