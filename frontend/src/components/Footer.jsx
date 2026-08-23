import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-neutral-900 text-neutral-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <h2 className="text-white text-lg font-bold tracking-tight mb-4">DIGITAL MUSEUM</h2>
            <p className="text-sm text-neutral-400">
              Explore history, art, and culture from around the world through our virtual and physical museum experiences.
            </p>
          </div>
          
          <div>
            <h3 className="text-white text-sm font-semibold tracking-wider uppercase mb-4">Navigation</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/museums" className="hover:text-white transition-colors">Museums</Link></li>
              <li><Link to="/explore" className="hover:text-white transition-colors">Explore</Link></li>
              <li><Link to="/physical" className="hover:text-white transition-colors">Physical Museum</Link></li>
              <li><Link to="/search" className="hover:text-white transition-colors">Search</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white text-sm font-semibold tracking-wider uppercase mb-4">Account</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/login" className="hover:text-white transition-colors">Login</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Register</Link></li>
              <li><Link to="/profile" className="hover:text-white transition-colors">Profile</Link></li>
              <li><Link to="/favourites" className="hover:text-white transition-colors">Favourites</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white text-sm font-semibold tracking-wider uppercase mb-4">Information</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="#" className="hover:text-white transition-colors">About</Link></li>
              <li><Link to="#" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-neutral-800 text-sm text-center text-neutral-500">
          <p>&copy; {new Date().getFullYear()} Digital Museum. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
