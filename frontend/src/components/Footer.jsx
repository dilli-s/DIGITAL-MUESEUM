import React from 'react';
import { Link } from 'react-router-dom';
import VanalokLogo from './common/VanalokLogo';

const Footer = () => {
  return (
    <footer className="bg-[#ede4d4] text-[#3d2e20] border-t border-[#d8c8b0] mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-12 sm:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 lg:gap-12">
          
          {/* Col 1: Brand */}
          <div className="col-span-1 md:col-span-1">
            <VanalokLogo className="mb-4" />
            <p className="text-xs sm:text-sm text-[#6e5842] leading-relaxed mt-3">
              Digital Museum is a next-generation cultural preservation platform connecting visitors with physical and virtual museum treasures worldwide.
            </p>
          </div>
          
          {/* Col 2: Navigation */}
          <div>
            <h3 className="font-['Cinzel'] text-[#241a10] text-xs font-bold tracking-[0.2em] uppercase mb-4">
              Explore
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li><Link to="/" className="text-[#5c4935] hover:text-[#8f6826] transition-colors">Home Gallery</Link></li>
              <li><Link to="/museums" className="text-[#5c4935] hover:text-[#8f6826] transition-colors">World Museums</Link></li>
              <li><Link to="/search?tab=collections" className="text-[#5c4935] hover:text-[#8f6826] transition-colors">Featured Collections</Link></li>
              <li><Link to="/about" className="text-[#5c4935] hover:text-[#8f6826] transition-colors">About Platform</Link></li>
            </ul>
          </div>

          {/* Col 3: Experience */}
          <div>
            <h3 className="font-['Cinzel'] text-[#241a10] text-xs font-bold tracking-[0.2em] uppercase mb-4">
              Experience
            </h3>
            <ul className="space-y-2.5 text-xs sm:text-sm">
              <li><Link to="/scan" className="text-[#5c4935] hover:text-[#8f6826] transition-colors">Scan QR Artifacts</Link></li>
              <li><Link to="/explore-more" className="text-[#5c4935] hover:text-[#8f6826] transition-colors">Indoor Navigation</Link></li>
              <li><Link to="/favourites" className="text-[#5c4935] hover:text-[#8f6826] transition-colors">Personal Vault</Link></li>
              <li><Link to="/profile" className="text-[#5c4935] hover:text-[#8f6826] transition-colors">Member Profile</Link></li>
            </ul>
          </div>

          {/* Col 4: Mobile App & Preservation */}
          <div>
            <h3 className="font-['Cinzel'] text-[#241a10] text-xs font-bold tracking-[0.2em] uppercase mb-3">
              Mobile App
            </h3>
            <p className="text-xs text-[#6e5842] leading-relaxed mb-3">
              Get the on-site companion guide with indoor navigation & artifact QR scanner.
            </p>
            <Link
              to="/download"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#dfd2be] hover:bg-[#8f6826] text-[#3d2e20] hover:text-[#fff8ea] text-xs font-semibold uppercase tracking-wider transition-colors shadow-xs"
            >
              <span>Scan QR & Download</span>
            </Link>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-[#d8c8b0] flex flex-col sm:flex-row items-center justify-between text-xs text-[#7a644e] gap-4">
          <p>&copy; {new Date().getFullYear()} Digital Museum. All Rights Reserved.</p>
          <div className="flex items-center gap-6">
            <span className="hover:text-[#241a10] cursor-pointer">Privacy Policy</span>
            <span className="hover:text-[#241a10] cursor-pointer">Terms of Heritage</span>
            <span className="hover:text-[#241a10] cursor-pointer">Contact Curators</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
