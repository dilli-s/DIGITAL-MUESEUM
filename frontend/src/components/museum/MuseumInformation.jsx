import React, { useState } from 'react';
import { Clock, MapPin, Accessibility, Info, Phone, Coffee } from 'lucide-react';

const MuseumInformation = ({ museum }) => {
  const [isLocating, setIsLocating] = useState(false);

  const handleGetDirections = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const origin = `${position.coords.latitude},${position.coords.longitude}`;
        const dest = museum.latitude && museum.longitude ? `${museum.latitude},${museum.longitude}` : encodeURIComponent(museum.location);
        window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`, '_blank', 'noopener,noreferrer');
      },
      () => {
        setIsLocating(false);
        alert("Unable to retrieve your location. Please check your browser permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <section className="mb-16 bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-neutral-900 mb-8">Plan Your Visit</h2>
      
      <div className="grid md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div className="flex w-full">
            <MapPin className="w-6 h-6 text-neutral-400 mr-4 flex-shrink-0" />
            <div className="w-full">
              <h3 className="font-semibold text-neutral-900">Location</h3>
              <p className="text-neutral-600 mt-1">{museum.location}</p>
              
              {museum.latitude && museum.longitude ? (
                <div className="mt-4 w-full h-48 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100 relative">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }}
                    loading="lazy" 
                    allowFullScreen 
                    referrerPolicy="no-referrer-when-downgrade" 
                    src={`https://maps.google.com/maps?q=${museum.latitude},${museum.longitude}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  ></iframe>
                </div>
              ) : museum.location ? (
                <div className="mt-4 w-full h-48 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100 relative">
                  <iframe 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0 }}
                    loading="lazy" 
                    allowFullScreen 
                    referrerPolicy="no-referrer-when-downgrade" 
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(museum.location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                  ></iframe>
                </div>
              ) : null}
              
              <div className="mt-3">
                <button 
                  onClick={handleGetDirections}
                  disabled={isLocating}
                  className="w-full text-sm px-4 py-3 bg-neutral-900 hover:bg-neutral-800 text-white font-medium rounded-md transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isLocating ? 'Detecting your location...' : 'Start Navigation from My Location'}
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex">
            <Clock className="w-6 h-6 text-neutral-400 mr-4 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-neutral-900">Opening Hours</h3>
              {museum.opening_hours ? (
                <p className="text-neutral-600 mt-1">{museum.opening_hours}</p>
              ) : (
                <p className="text-neutral-400 mt-1 italic">Hours not specified</p>
              )}
            </div>
          </div>

          <div className="flex">
            <Phone className="w-6 h-6 text-neutral-400 mr-4 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-neutral-900">Contact</h3>
              {museum.contact_email ? (
                <p className="text-neutral-600 mt-1">{museum.contact_email}</p>
              ) : null}
              {museum.contact_phone ? (
                <p className="text-neutral-600">{museum.contact_phone}</p>
              ) : null}
              {!museum.contact_email && !museum.contact_phone && (
                <p className="text-neutral-400 mt-1 italic">Contact not specified</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-neutral-900 mb-4">Visitor Facilities</h3>
          <div className="grid grid-cols-2 gap-4">
            {museum.wheelchair_access ? (
              <div className="flex items-center text-neutral-600 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                <Accessibility className="w-5 h-5 mr-3 text-emerald-500" />
                <span className="text-sm font-medium">Wheelchair Access</span>
              </div>
            ) : null}
            {museum.info_desk ? (
              <div className="flex items-center text-neutral-600 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                <Info className="w-5 h-5 mr-3 text-blue-500" />
                <span className="text-sm font-medium">Information Desk</span>
              </div>
            ) : null}
            {museum.cafe_restrooms ? (
              <div className="flex items-center text-neutral-600 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                <Coffee className="w-5 h-5 mr-3 text-amber-500" />
                <span className="text-sm font-medium">Cafe & Restrooms</span>
              </div>
            ) : null}
            {!museum.wheelchair_access && !museum.info_desk && !museum.cafe_restrooms && (
              <div className="col-span-2 text-neutral-400 italic text-sm py-4">No specific facilities listed.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MuseumInformation;
