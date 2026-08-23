import React, { useState, useEffect } from 'react';
import LearningCard from './LearningCard';
import { getLearning } from '../../services/api';
import { stories } from '../../data/stories';
import { activities } from '../../data/activities';

const RelatedLearning = ({ objectId }) => {
  const [relatedLearning, setRelatedLearning] = useState([]);
  
  useEffect(() => {
    if (objectId) {
      getLearning({ object_id: objectId })
        .then(res => setRelatedLearning(res.data || []))
        .catch(console.error);
    }
  }, [objectId]);

  if (!objectId) return null;

  const relatedStories = stories.filter(s => String(s.objectId) === String(objectId));
  const relatedActivities = activities.filter(a => String(a.objectId) === String(objectId));

  const totalItems = relatedLearning.length + relatedStories.length + relatedActivities.length;

  if (totalItems === 0) return null;

  return (
    <section className="mb-16 border-t border-neutral-200 pt-16">
      <h2 className="text-3xl font-bold text-neutral-900 mb-10">Keep Learning</h2>
      
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {relatedLearning.map(item => (
          <LearningCard key={`l-${item.id}`} item={item} type="learning" />
        ))}
        {relatedStories.map(item => (
          <LearningCard key={`s-${item.id}`} item={item} type="story" />
        ))}
        {relatedActivities.map(item => (
          <LearningCard key={`a-${item.id}`} item={item} type="activity" />
        ))}
      </div>
    </section>
  );
};

export default RelatedLearning;
