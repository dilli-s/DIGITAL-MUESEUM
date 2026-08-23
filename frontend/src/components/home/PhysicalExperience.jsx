import React from 'react';
import { Link } from 'react-router-dom';
import { Scan, Map, Fingerprint } from 'lucide-react';

const PhysicalExperience = () => {
  return (
    <section className="py-20 my-12 border-y border-neutral-200 bg-neutral-50 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 mb-4">Your Museum Visit, Reimagined</h2>
            <p className="text-xl text-neutral-600 mb-8">Scan. Explore. Learn.</p>
            
            <div className="space-y-8 mb-10">
              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-neutral-900 text-white">
                    <Scan className="h-6 w-6" />
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg leading-6 font-medium text-neutral-900">1. Scan the museum QR code</h3>
                  <p className="mt-2 text-base text-neutral-500">Access the platform instantly when you arrive without downloading any apps.</p>
                </div>
              </div>

              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-neutral-900 text-white">
                    <Map className="h-6 w-6" />
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg leading-6 font-medium text-neutral-900">2. Navigate the museum digitally</h3>
                  <p className="mt-2 text-base text-neutral-500">Use our interactive map to find exhibits, facilities, and your current location.</p>
                </div>
              </div>

              <div className="flex">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-md bg-neutral-900 text-white">
                    <Fingerprint className="h-6 w-6" />
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg leading-6 font-medium text-neutral-900">3. Scan objects to discover their stories</h3>
                  <p className="mt-2 text-base text-neutral-500">Unlock audio guides, related historical context, and multimedia for artifacts.</p>
                </div>
              </div>
            </div>

            <Link 
              to="/physical" 
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-neutral-900 hover:bg-neutral-800"
            >
              EXPLORE PHYSICAL MUSEUM
            </Link>
          </div>

          <div className="relative">
            {/* Phone Mockup Placeholder */}
            <div className="relative mx-auto w-full max-w-[300px] h-[600px] border-[14px] border-neutral-900 rounded-[2.5rem] bg-white overflow-hidden shadow-2xl">
              <div className="absolute top-0 inset-x-0 h-6 bg-neutral-900 rounded-b-3xl w-40 mx-auto"></div>
              <div className="p-6 pt-12 flex flex-col items-center text-center h-full bg-neutral-50">
                <Scan className="w-16 h-16 text-neutral-300 mb-6" />
                <h4 className="text-xl font-bold mb-2">Ready to Scan</h4>
                <p className="text-sm text-neutral-500">Point your camera at a museum object QR code.</p>
                <div className="mt-auto w-full">
                  <div className="h-48 rounded-xl bg-neutral-200 border-2 border-dashed border-neutral-400 flex items-center justify-center">
                    <span className="text-neutral-500 font-medium">Camera Viewfinder</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PhysicalExperience;
