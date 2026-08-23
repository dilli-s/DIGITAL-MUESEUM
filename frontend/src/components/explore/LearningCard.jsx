import React from 'react';
import { Lightbulb, PlayCircle, FileText } from 'lucide-react';

const LearningCard = ({ learningItem }) => {
  const isVideo = learningItem.type === 'video';
  const Icon = isVideo ? PlayCircle : FileText;

  return (
    <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-200 flex items-start gap-4 hover:bg-neutral-100 transition-colors cursor-pointer">
      <div className={`p-3 rounded-lg flex-shrink-0 ${isVideo ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-900 border border-neutral-200'}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h3 className="font-semibold text-neutral-900 mb-1">{learningItem.title}</h3>
        <p className="text-sm text-neutral-600">{learningItem.description}</p>
      </div>
    </div>
  );
};

export default LearningCard;
