import React from 'react';
import ObjectCard from './ObjectCard';

const RelatedObjects = ({ relatedObjects }) => {
  if (!relatedObjects || relatedObjects.length === 0) return null;

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Related Objects</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {relatedObjects.map(obj => (
          <ObjectCard key={obj.id} objectData={obj} />
        ))}
      </div>
    </section>
  );
};

export default RelatedObjects;
