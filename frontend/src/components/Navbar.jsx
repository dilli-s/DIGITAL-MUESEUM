import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { Search, Globe, Menu, X, LogOut, User, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import VanalokLogo from './common/VanalokLogo';

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
    { name: 'Collections', path: '/search?tab=collections' },
    { name: 'Nearby Map', path: '/map' },
    { name: 'About', path: '/about' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#f7f2e8]/95 backdrop-blur-md border-b border-[#d8c8b0] shadow-sm">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center">
            <VanalokLogo />
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-9">
            {navLinks.map((link) => (
              <NavLink
                key={link.name}
                to={link.path}
                className={({ isActive }) =>
                  `text-sm tracking-wide font-medium transition-all relative py-1 ${
                    isActive
                      ? 'text-[#8f6826] font-bold after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-[#8f6826]'
                      : 'text-[#5a4836] hover:text-[#241a10]'
                  }`
                }
              >
                {link.name}
              </NavLink>
            ))}
          </nav>

          {/* Right Action Icons & Auth */}
          <div className="hidden md:flex items-center space-x-5">
            <Link 
              to="/search" 
              className="text-[#6e5842] hover:text-[#241a10] p-2 rounded-full hover:bg-[#eae0d0] transition-colors" 
              aria-label="Search"
              title="Search Archives"
            >
              <Search className="w-4 h-4" />
            </Link>

            {/* Globe / Map Icon for Nearby Museums */}
            <NavLink 
              to="/map"
              className={({ isActive }) => 
                `p-2 rounded-full transition-all flex items-center justify-center ${
                  isActive 
                    ? 'bg-[#8f6826] text-[#fff8ea] shadow-sm' 
                    : 'text-[#6e5842] hover:text-[#241a10] hover:bg-[#eae0d0]'
                }`
              }
              aria-label="Nearby Museums Map"
              title="Nearby Museums Map (GPS Location)"
            >
              <Globe className="w-4 h-4" />
            </NavLink>

            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <Link 
                  to="/profile" 
                  className="text-xs tracking-wider uppercase font-semibold text-[#241a10] flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#d8c8b0] bg-[#fdfbf7] hover:border-[#8f6826] transition-colors shadow-xs"
                >
                  <User className="w-3.5 h-3.5 text-[#8f6826]" />
                  <span>{user?.name?.split(' ')[0] || 'Profile'}</span>
                </Link>
                
                {user?.role === 'admin' && (
                  <Link 
                    to="/admin/dashboard" 
                    className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#8f6826]/15 text-[#8f6826] border border-[#8f6826]/30 hover:bg-[#8f6826]/25"
                  >
                    Admin
                  </Link>
                )}

                <button 
                  onClick={handleLogout} 
                  className="p-2 text-[#7a644e] hover:text-red-600 hover:bg-[#eae0d0] rounded-full transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link 
                to="/login" 
                className="inline-flex items-center justify-center px-5 py-2 text-xs font-semibold tracking-wider text-[#241a10] border border-[#8f6826] rounded-full hover:bg-[#8f6826] hover:text-[#fff8ea] transition-all uppercase shadow-xs"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile menu hamburger button */}
          <div className="flex items-center md:hidden gap-1.5">
            <Link 
              to="/map" 
              className="text-[#6e5842] p-2 rounded-lg hover:text-[#241a10] hover:bg-[#eae0d0]" 
              aria-label="Nearby Map"
              title="Nearby Map"
            >
              <Globe className="w-5 h-5 text-[#8f6826]" />
            </Link>

            <Link 
              to="/search" 
              className="text-[#6e5842] p-2 rounded-lg hover:text-[#241a10] hover:bg-[#eae0d0]" 
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </Link>

            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-[#6e5842] hover:text-[#241a10] rounded-lg focus:outline-none"
              aria-expanded={isOpen}
              aria-label={isOpen ? "Close menu" : "Open menu"}
            >
              {isOpen ? <X className="w-6 h-6 text-[#8f6826]" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {isOpen && (
        <div className="md:hidden border-t border-[#d8c8b0] bg-[#f7f2e8]/98 px-4 pt-3 pb-6 space-y-2 shadow-lg">
          {navLinks.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-2.5 rounded-lg text-sm font-medium tracking-wide ${
                  isActive
                    ? 'bg-[#8f6826]/15 text-[#8f6826] border-l-2 border-[#8f6826] font-bold'
                    : 'text-[#5a4836] hover:bg-[#ede3d1] hover:text-[#241a10]'
                }`
              }
            >
              {link.name}
            </NavLink>
          ))}
          
          <div className="pt-3 border-t border-[#d8c8b0] space-y-2">
            {isAuthenticated ? (
              <>
                <div className="px-4 py-2 text-xs text-[#7a644e]">
                  Signed in as <span className="text-[#241a10] font-semibold">{user?.email}</span>
                </div>
                <NavLink
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2 text-sm text-[#5a4836] hover:bg-[#ede3d1] rounded-lg"
                >
                  Profile & Activity
                </NavLink>
                <NavLink
                  to="/favourites"
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-2 text-sm text-[#5a4836] hover:bg-[#ede3d1] rounded-lg"
                >
                  Saved Favourites
                </NavLink>
                {user?.role === 'admin' && (
                  <NavLink
                    to="/admin/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="block px-4 py-2 text-sm text-[#8f6826] font-semibold hover:bg-[#ede3d1] rounded-lg"
                  >
                    Admin Dashboard
                  </NavLink>
                )}
                <button
                  onClick={() => { setIsOpen(false); handleLogout(); }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-[#ede3d1] rounded-lg"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="text-center py-2.5 text-xs uppercase font-semibold tracking-wider text-[#241a10] border border-[#8f6826] rounded-full hover:bg-[#8f6826] hover:text-[#fff8ea]"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setIsOpen(false)}
                  className="text-center py-2.5 text-xs uppercase font-semibold tracking-wider text-[#fff8ea] bg-[#8f6826] rounded-full hover:bg-[#a87d32]"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
