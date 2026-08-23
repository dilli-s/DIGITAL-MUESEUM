import React from 'react';
import { Compass } from 'lucide-react';

const ThemeCard = ({ theme }) => {
  return (
    <div className="group bg-neutral-900 rounded-2xl overflow-hidden relative h-48 flex items-end">
      <div className="absolute inset-0 bg-gradient-to-t from-black via-neutral-900/50 to-transparent z-10"></div>
      <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
         {/* Placeholder for theme image */}
         <Compass className="w-16 h-16 text-neutral-600 opacity-30" />
      </div>
      <div className="relative z-20 p-6">
        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-neutral-300 transition-colors">{theme.name}</h3>
        <p className="text-sm text-neutral-400 line-clamp-1">{theme.description}</p>
      </div>
    </div>
  );
};

export default ThemeCard;
