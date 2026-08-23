import React from 'react';
import { Link } from 'react-router-dom';

const FinalCTA = () => {
  return (
    <section className="py-24 text-center">
      <div className="max-w-3xl mx-auto px-4">
        <h2 className="text-4xl font-bold tracking-tight text-neutral-900 mb-6">Start Your Museum Journey</h2>
        <p className="text-xl text-neutral-600 mb-10">
          Explore remarkable collections online or discover a smarter way to experience museums in person.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link 
            to="/museums" 
            className="inline-flex justify-center rounded-md bg-neutral-900 px-8 py-4 text-base font-semibold text-white hover:bg-neutral-800 transition-colors"
          >
            EXPLORE MUSEUMS
          </Link>
          <Link 
            to="/museum/1" 
            className="inline-flex justify-center rounded-md bg-white px-8 py-4 text-base font-semibold text-neutral-900 border border-neutral-300 hover:bg-neutral-50 transition-colors"
          >
            START VIRTUAL TOUR
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
