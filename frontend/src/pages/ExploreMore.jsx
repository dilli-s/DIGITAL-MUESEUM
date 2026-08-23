import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getObject, getLearning } from '../services/api';
import { themes } from '../data/themes';
import { stories } from '../data/stories';
import { ChevronRight, ArrowLeft, RefreshCw } from 'lucide-react';

import RelatedObjects from '../components/object/RelatedObjects';
import ThemeCard from '../components/explore/ThemeCard';
import StoryCard from '../components/explore/StoryCard';
import LearningCard from '../components/explore/LearningCard';

const ExploreMore = () => {
  const { objectId } = useParams();
  
  const [object, setObject] = useState(null);
  const [learningItems, setLearningItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchObjAndLearning = async () => {
      try {
        const obj = await getObject(objectId);
        setObject(obj);
        
        const lr = await getLearning({ object_id: objectId });
        setLearningItems(lr.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchObjAndLearning();
  }, [objectId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <RefreshCw className="w-8 h-8 animate-spin text-neutral-900" />
      </div>
    );
  }

  if (!object) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-4 text-center">
        <h1 className="text-3xl font-bold mb-4 text-neutral-900">Object Not Found</h1>
        <p className="text-neutral-600 mb-8 max-w-md">
          The object you're looking for could not be found.
        </p>
        <Link 
          to="/museums" 
          className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
        >
          Back to Museums
        </Link>
      </div>
    );
  }

  // Resolve related content
  // Note: related objects are not supported by the Phase 12 database schema yet.
  const relatedObjects = [];
  
  const relatedThemes = (object.themeIds || []).map(id => themes.find(t => String(t.id) === String(id))).filter(Boolean);
  const objectStories = stories.filter(s => String(s.objectId) === String(objectId));
  const objectLearning = learningItems;

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <nav className="flex text-sm text-neutral-500 mb-6" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2">
          <li>
            <Link to={`/objects/${object.id}`} className="hover:text-neutral-900 transition-colors flex items-center">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Object
            </Link>
          </li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-12 border-b border-neutral-200 pb-8 text-center max-w-3xl mx-auto">
        <div className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-2">Explore More</div>
        <h1 className="text-4xl font-bold tracking-tight text-neutral-900 mb-4">{object.name}</h1>
        <p className="text-lg text-neutral-600">
          Discover related themes, deep dive into stories, and access learning materials connected to this object.
        </p>
      </div>

      {/* Related Objects */}
      {relatedObjects.length > 0 ? (
        <RelatedObjects relatedObjects={relatedObjects} />
      ) : (
        <section className="mb-16">
           <h2 className="text-2xl font-bold text-neutral-900 mb-6">Related Objects</h2>
           <div className="bg-neutral-50 rounded-xl p-8 text-center border border-neutral-200 border-dashed text-neutral-500">
             No related objects available.
           </div>
        </section>
      )}

      {/* Related Themes */}
      {relatedThemes.length > 0 && (
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-neutral-900 mb-6">Related Themes</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {relatedThemes.map(theme => (
              <ThemeCard key={theme.id} theme={theme} />
            ))}
          </div>
        </section>
      )}

      {/* Stories */}
      {objectStories.length > 0 && (
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-neutral-900 mb-6">Stories</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {objectStories.map(story => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      )}

      {/* Learning Content */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-neutral-900 mb-6">Learning Content</h2>
        {objectLearning.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {objectLearning.map(item => (
              <LearningCard key={item.id} learningItem={item} />
            ))}
          </div>
        ) : (
          <div className="bg-neutral-50 rounded-xl p-8 text-center border border-neutral-200 border-dashed text-neutral-500">
            Learning content coming soon.
          </div>
        )}
      </section>

    </div>
  );
};

export default ExploreMore;
