import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import FloatingAssistant from '../components/common/FloatingAssistant';

// Routes that should render full-screen without Navbar / Footer
const FULLSCREEN_PATHS = [
  '/tour',   // matches /museum/:id/tour and /museum/:id/tour/:nodeId
  '/map',    // matches /museum/:id/map
];

const isFullscreen = (pathname) =>
  FULLSCREEN_PATHS.some((seg) => pathname.includes(seg));

const MainLayout = ({ children }) => {
  const { pathname } = useLocation();

  if (isFullscreen(pathname)) {
    return <>{children}</>;
  }

  const isHome = pathname === '/';

  return (
    <div className="flex flex-col min-h-screen w-full parchment-bg text-[#241a10] font-sans selection:bg-[#c89b3c]/25 selection:text-[#3b2a1a] overflow-x-hidden relative">
      <Navbar />
      <main className={`flex-grow w-full ${isHome ? '' : 'max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-6'}`}>
        {children}
      </main>
      <Footer />
      <FloatingAssistant />
    </div>
  );
};

export default MainLayout;
