import React from 'react';
import { Clock, MapPin, Accessibility, Info, Phone, Coffee } from 'lucide-react';

const MuseumInformation = ({ museum }) => {
  return (
    <section className="mb-16 bg-white rounded-2xl border border-neutral-200 p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-neutral-900 mb-8">Plan Your Visit</h2>
      
      <div className="grid md:grid-cols-2 gap-12">
        <div className="space-y-6">
          <div className="flex">
            <MapPin className="w-6 h-6 text-neutral-400 mr-4 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-neutral-900">Location</h3>
              <p className="text-neutral-600 mt-1">{museum.location}</p>
              <p className="text-sm text-neutral-500 mt-2 italic">Note: This is demo information.</p>
            </div>
          </div>
          
          <div className="flex">
            <Clock className="w-6 h-6 text-neutral-400 mr-4 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-neutral-900">Opening Hours</h3>
              <p className="text-neutral-600 mt-1">Monday - Sunday: 10:00 AM - 6:00 PM</p>
              <p className="text-neutral-600">Last entry at 5:00 PM</p>
            </div>
          </div>

          <div className="flex">
            <Phone className="w-6 h-6 text-neutral-400 mr-4 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-neutral-900">Contact</h3>
              <p className="text-neutral-600 mt-1">info@examplemuseum.com</p>
              <p className="text-neutral-600">+1 (555) 123-4567</p>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-neutral-900 mb-4">Visitor Facilities</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center text-neutral-600 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
              <Accessibility className="w-5 h-5 mr-3 text-neutral-400" />
              <span className="text-sm font-medium">Wheelchair Access</span>
            </div>
            <div className="flex items-center text-neutral-600 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
              <Info className="w-5 h-5 mr-3 text-neutral-400" />
              <span className="text-sm font-medium">Information Desk</span>
            </div>
            <div className="flex items-center text-neutral-600 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
              <Coffee className="w-5 h-5 mr-3 text-neutral-400" />
              <span className="text-sm font-medium">Cafe & Restrooms</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MuseumInformation;
