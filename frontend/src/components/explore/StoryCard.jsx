import React from 'react';
import { BookOpen } from 'lucide-react';

const StoryCard = ({ story }) => {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="h-40 bg-neutral-100 flex items-center justify-center relative flex-shrink-0">
        <BookOpen className="w-12 h-12 text-neutral-300" />
      </div>
      <div className="p-6 flex flex-col flex-grow">
        <h3 className="text-lg font-bold text-neutral-900 mb-2">{story.title}</h3>
        <p className="text-sm text-neutral-600 mb-4 flex-grow">{story.summary}</p>
        <button className="text-sm font-semibold text-neutral-900 hover:underline self-start mt-auto">
          Read Story <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
};

export default StoryCard;
