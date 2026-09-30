import React from 'react';
import { Link } from 'react-router-dom';

const VanalokLogo = ({ className = '', showTagline = true, light = false }) => {
  return (
    <Link to="/" className={`group flex items-center gap-3 select-none ${className}`}>
      {/* Classical Temple Icon */}
      <div className="relative flex items-center justify-center">
        <svg 
          viewBox="0 0 32 32" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className={`w-7 h-7 sm:w-8 sm:h-8 transition-transform group-hover:scale-105 duration-300 ${
            light ? 'text-[#e5c158]' : 'text-[#8f6826]'
          }`}
        >
          {/* Triangular pediment roof */}
          <path d="M4 11L16 4L28 11H4Z" strokeWidth="1.6" fill="currentColor" fillOpacity="0.12" />
          {/* Entablature beam */}
          <path d="M3 11H29" strokeWidth="1.8" />
          <path d="M5 14H27" strokeWidth="1.2" />
          {/* 4 Classical Pillars */}
          <path d="M7 14V24" strokeWidth="1.8" />
          <path d="M13 14V24" strokeWidth="1.8" />
          <path d="M19 14V24" strokeWidth="1.8" />
          <path d="M25 14V24" strokeWidth="1.8" />
          {/* Podium / Base Steps */}
          <path d="M4 24H28" strokeWidth="1.6" />
          <path d="M2 27H30" strokeWidth="2" />
        </svg>
      </div>

      <div className="flex flex-col text-left">
        <span className={`font-['Cinzel'] font-bold text-base sm:text-lg tracking-[0.22em] leading-tight uppercase transition-colors ${
          light ? 'text-[#fbf7ee] group-hover:text-[#e5c158]' : 'text-[#241a10] group-hover:text-[#8f6826]'
        }`}>
          DIGITAL MUSEUM
        </span>
        {showTagline && (
          <span className={`text-[8px] sm:text-[9px] font-semibold tracking-[0.25em] uppercase mt-0.5 ${
            light ? 'text-[#a89984]' : 'text-[#7a644e]'
          }`}>
            EXPLORE · LEARN · PRESERVE
          </span>
        )}
      </div>
    </Link>
  );
};

export default VanalokLogo;
