import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin } from 'lucide-react';

const ExhibitionCard = ({ exhibition, museumId }) => {
  // Determine Status
  let status = "Permanent";
  let statusColor = "bg-neutral-600";
  
  if (exhibition.startDate && exhibition.endDate) {
    const now = new Date();
    const start = new Date(exhibition.startDate);
    const end = new Date(exhibition.endDate);
    
    if (now < start) {
      status = "Upcoming";
      statusColor = "bg-blue-600";
    } else if (now > end) {
      status = "Past";
      statusColor = "bg-neutral-400";
    } else {
      status = "Current";
      statusColor = "bg-green-600";
    }
  }

  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-lg transition-all flex flex-col h-full">
      <div className="h-48 bg-neutral-200 relative overflow-hidden flex-shrink-0 flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-tr from-neutral-300 to-neutral-100 flex items-center justify-center">
          <Calendar className="w-16 h-16 text-neutral-400" />
        </div>
        <div className={`absolute top-4 left-4 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${statusColor}`}>
          {status}
        </div>
        {exhibition.featured && (
          <div className="absolute top-4 right-4 bg-neutral-900 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            Featured
          </div>
        )}
      </div>
      
      <div className="p-6 flex-grow flex flex-col">
        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
          {exhibition.category} {exhibition.period && `• ${exhibition.period}`}
        </div>
        
        <h3 className="text-xl font-bold text-neutral-900 mb-1">{exhibition.title}</h3>
        {exhibition.subtitle && (
          <h4 className="text-sm font-medium text-neutral-500 mb-3">{exhibition.subtitle}</h4>
        )}
        
        <p className="text-neutral-600 text-sm mb-6 flex-grow line-clamp-3">
          {exhibition.description}
        </p>
        
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex items-center text-sm font-medium text-neutral-500">
            <span>{exhibition.objectIds?.length || 0} Objects</span>
          </div>
        </div>
        
        <Link 
          to={`/museum/${museumId}/exhibition/${exhibition.id}`} 
          className="w-full inline-flex justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 transition-colors mt-auto"
        >
          EXPLORE EXHIBITION
        </Link>
      </div>
    </div>
  );
};

export default ExhibitionCard;
