import React from 'react';
import { NavLink } from 'react-router-dom';

const MuseumNavigation = ({ museumId }) => {
  const links = [
    { name: 'Overview', path: `/museums/${museumId}` },
    { name: 'Virtual Entrance', path: `/museum/${museumId}` },
    { name: 'Galleries', path: `/museum/${museumId}/galleries` }
  ];

  return (
    <nav className="mb-12 border-b border-neutral-200 hide-scrollbar overflow-x-auto">
      <ul className="flex space-x-8 min-w-max px-2">
        {links.map(link => (
          <li key={link.name}>
            <NavLink
              to={link.path}
              end={link.path === `/museums/${museumId}`}
              className={({ isActive }) =>
                `inline-block pb-4 text-sm font-medium transition-colors border-b-2 ${
                  isActive
                    ? 'border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
                }`
              }
            >
              {link.name}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default MuseumNavigation;
