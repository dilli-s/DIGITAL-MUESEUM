import React from 'react';
import { NavLink } from 'react-router-dom';

const MuseumNavigation = ({ museumId }) => {
  const links = [
    { name: 'Overview', path: `/museums/${museumId}` },
    { name: 'Virtual Entrance', path: `/museum/${museumId}` },
    { name: '360° Virtual Tour', path: `/museum/${museumId}/tour` },
    { name: 'Interactive Map', path: `/museum/${museumId}/map` },
    { name: 'Galleries', path: `/museum/${museumId}/galleries` }
  ];

  return (
    <nav className="mb-12 border-b border-neutral-200 hide-scrollbar overflow-x-auto">
      <ul className="flex space-x-8 min-w-max px-2">
        {links.map(link => {
          const isTour = link.name.includes('360°');
          return (
            <li key={link.name}>
              <NavLink
                to={link.path}
                end={link.path === `/museums/${museumId}`}
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 pb-4 text-sm font-medium transition-all border-b-2 ${
                    isActive
                      ? 'border-neutral-900 text-neutral-900 font-bold'
                      : isTour
                      ? 'border-transparent text-amber-600 hover:text-amber-700 hover:border-amber-400 font-semibold'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
                  }`
                }
              >
                {isTour && (
                  <span className="relative flex h-2 w-2 mr-0.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                )}
                <span>{link.name}</span>
                {isTour && (
                  <span className="ml-1 px-1.5 py-0.2 text-[10px] uppercase font-bold tracking-wider rounded bg-amber-100 text-amber-800 border border-amber-300">
                    Live
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default MuseumNavigation;
