import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Search, Menu, X, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Museums', path: '/museums' },
    { name: 'Physical Museum', path: '/physical' },
    { name: 'Scan Object', path: '/scan' },
    { name: 'Assistant', path: '/assistant' },
  ];

  return (
    <nav className="bg-white border-b border-neutral-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="font-bold text-xl text-neutral-900 tracking-tight">Digital Museum</span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) =>
                  `inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-neutral-900 text-neutral-900'
                      : 'border-transparent text-neutral-500 hover:text-neutral-900 hover:border-neutral-300'
                  }`
                }
              >
                {link.name}
              </NavLink>
            ))}
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link to="/search" className="text-neutral-500 hover:text-neutral-900 p-2 rounded-full hover:bg-neutral-100 transition-colors" aria-label="Search">
              <Search className="w-5 h-5" />
            </Link>
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <Link to="/profile" className="text-sm font-medium text-neutral-700 flex items-center hover:text-neutral-900">
                  <User className="w-4 h-4 mr-1" />
                  Profile
                </Link>
                <Link to="/favourites" className="text-sm font-medium text-neutral-700 flex items-center hover:text-neutral-900">
                  Favourites
                </Link>
                {user?.role === 'admin' && (
                  <Link to="/admin/dashboard" className="text-sm font-bold text-blue-600 flex items-center hover:text-blue-800">
                    Admin
                  </Link>
                )}
                <button onClick={handleLogout} className="inline-flex items-center justify-center px-4 py-2 border border-neutral-300 rounded-md shadow-sm text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 transition-colors">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </button>
              </div>
            ) : (
              <Link to="/login" className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-neutral-900 hover:bg-neutral-800 transition-colors">
                Login
              </Link>
            )}
          </div>

          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-neutral-900"
              aria-expanded={isOpen}
              aria-label={isOpen ? "Close menu" : "Open menu"}
            >
              {isOpen ? <X className="block h-6 w-6" aria-hidden="true" /> : <Menu className="block h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden border-t border-neutral-200">
          <div className="pt-2 pb-3 space-y-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                    isActive
                      ? 'bg-neutral-50 border-neutral-900 text-neutral-900'
                      : 'border-transparent text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900'
                  }`
                }
              >
                {link.name}
              </NavLink>
            ))}
            <NavLink
              to="/search"
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  isActive
                    ? 'bg-neutral-50 border-neutral-900 text-neutral-900'
                    : 'border-transparent text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900'
                }`
              }
            >
              Search
            </NavLink>
            
            {isAuthenticated ? (
              <>
                <div className="px-4 py-3 border-t border-neutral-200 mt-2 bg-neutral-50">
                  <p className="text-sm font-medium text-neutral-900">{user?.name}</p>
                  <p className="text-sm font-medium text-neutral-500 truncate">{user?.email}</p>
                </div>
                <NavLink
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900"
                >
                  Profile
                </NavLink>
                <NavLink
                  to="/favourites"
                  onClick={() => setIsOpen(false)}
                  className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900"
                >
                  Favourites
                </NavLink>
                {user?.role === 'admin' && (
                  <NavLink
                    to="/admin/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-bold text-blue-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-800"
                  >
                    Admin Dashboard
                  </NavLink>
                )}
                <button
                  onClick={() => { setIsOpen(false); handleLogout(); }}
                  className="block w-full text-left pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                      isActive
                        ? 'bg-neutral-50 border-neutral-900 text-neutral-900'
                        : 'border-transparent text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900'
                    }`
                  }
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                      isActive
                        ? 'bg-neutral-50 border-neutral-900 text-neutral-900'
                        : 'border-transparent text-neutral-500 hover:bg-neutral-50 hover:border-neutral-300 hover:text-neutral-900'
                    }`
                  }
                >
                  Register
                </NavLink>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
