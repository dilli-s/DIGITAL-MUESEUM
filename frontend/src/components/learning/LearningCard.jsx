import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FileText, BookOpen, Target, Clock, BarChart } from 'lucide-react';
import { getObject } from '../../services/api';

const LearningCard = ({ item, type }) => {
  const [objectName, setObjectName] = useState(null);

  useEffect(() => {
    if (item.objectId) {
      getObject(item.objectId)
        .then(obj => setObjectName(obj.name))
        .catch(err => console.error(err));
    }
  }, [item.objectId]);

  // item could be a learning resource, story, or activity
  
  let routePrefix = '/learning';
  let Icon = FileText;
  let typeLabel = item.type === 'video' ? 'Video' : 'Article';
  let btnLabel = 'START LEARNING';
  
  if (type === 'story') {
    routePrefix = '/stories';
    Icon = BookOpen;
    typeLabel = 'Story';
    btnLabel = 'READ STORY';
  } else if (type === 'activity') {
    routePrefix = '/learning/activity';
    Icon = Target;
    typeLabel = 'Activity';
    btnLabel = 'START ACTIVITY';
  } else if (item.type === 'video') {
    btnLabel = 'WATCH VIDEO';
  }

  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-lg transition-all flex flex-col h-full">
      {item.image && (
        <div className="h-48 relative overflow-hidden flex-shrink-0">
          <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      )}
      
      {!item.image && (
        <div className="h-32 bg-neutral-100 flex items-center justify-center flex-shrink-0">
          <Icon className="w-12 h-12 text-neutral-300" />
        </div>
      )}

      <div className="p-6 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            {typeLabel}
          </div>
          {item.difficulty && (
            <div className="flex items-center text-xs font-medium text-neutral-500">
              <BarChart className="w-3 h-3 mr-1" />
              {item.difficulty}
            </div>
          )}
        </div>
        
        <h3 className="text-xl font-bold text-neutral-900 mb-2">{item.title}</h3>
        <p className="text-neutral-600 text-sm mb-4 flex-grow line-clamp-3">
          {item.description || item.summary}
        </p>
        
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-neutral-100">
          <div className="flex items-center text-sm font-medium text-neutral-500">
            {item.duration && (
              <span className="flex items-center mr-4">
                <Clock className="w-4 h-4 mr-1" /> {item.duration}
              </span>
            )}
            {objectName && <span className="truncate max-w-[120px]">{objectName}</span>}
          </div>
        </div>
        
        <Link 
          to={`${routePrefix}/${item.id}`}
          className="mt-6 w-full inline-flex justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors"
        >
          {btnLabel}
        </Link>
      </div>
    </div>
  );
};

export default LearningCard;
