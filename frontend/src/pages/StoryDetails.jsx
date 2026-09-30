import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { stories } from '../data/stories';
import { getObject } from '../services/api';
import { ArrowLeft, Clock } from 'lucide-react';
import RelatedLearning from '../components/learning/RelatedLearning';
import { getMediaUrl } from '../utils/media';

const StoryDetails = () => {
  const { storyId } = useParams();
  const story = stories.find(s => String(s.id) === String(storyId));
  const [object, setObject] = useState(null);

  useEffect(() => {
    if (story && story.objectId) {
      getObject(story.objectId).then(setObject).catch(console.error);
    }
  }, [story]);

  if (!story) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold text-neutral-900 mb-4">Story Not Found</h2>
        <Link to="/learning" className="inline-flex items-center text-sm font-semibold text-neutral-900 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Learning Hub
        </Link>
      </div>
    );
  }

  const storyImgUrl = story.image ? getMediaUrl(story.image) : null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Navigation */}
      <nav className="mb-8">
        <Link to="/learning" className="inline-flex items-center text-sm font-semibold text-neutral-600 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Learning Hub
        </Link>
      </nav>

      {/* Story Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-12 bg-neutral-900 min-h-[400px] flex items-end">
        {storyImgUrl ? (
          <img src={storyImgUrl} alt={story.title} className="absolute inset-0 w-full h-full object-cover opacity-50" />
        ) : (
          <div className="absolute inset-0 bg-neutral-800"></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-neutral-900/60 to-transparent"></div>
        
        <div className="relative z-10 p-8 md:p-12 w-full text-white">
          <div className="flex items-center gap-4 mb-4 text-sm font-medium text-neutral-300">
            <span className="uppercase tracking-wider font-bold">Story</span>
            {story.duration && <span className="flex items-center"><Clock className="w-4 h-4 mr-1" /> {story.duration}</span>}
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">{story.title}</h1>
          <p className="text-xl text-neutral-300 max-w-2xl">{story.summary}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto mb-16">
        <div className="bg-white rounded-2xl p-8 md:p-12 text-lg text-neutral-800 leading-relaxed space-y-10">
          {story.content && story.content.map((section, idx) => (
            <section key={idx}>
              {section.heading && <h2 className="text-2xl font-bold text-neutral-900 mb-4">{section.heading}</h2>}
              {section.text && <p>{section.text}</p>}
            </section>
          ))}
        </div>
      </div>

      {object && (
        <div className="mb-16 bg-neutral-50 border border-neutral-200 p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-1">Related Object</h3>
            <p className="text-xl font-bold text-neutral-900">{object.name}</p>
          </div>
          <Link to={`/objects/${object.id}`} className="px-6 py-3 bg-neutral-900 text-white rounded-md font-semibold text-sm hover:bg-neutral-800">
            VIEW OBJECT
          </Link>
        </div>
      )}

      {object && <RelatedLearning objectId={object.id} />}
    </div>
  );
};

export default StoryDetails;
