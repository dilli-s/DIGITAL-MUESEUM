import React from 'react';

const HowItWorks = () => {
  return (
    <section className="py-16 text-center">
      <h2 className="text-3xl font-bold tracking-tight text-neutral-900 mb-12">How the Virtual Journey Works</h2>
      
      <div className="flex flex-col md:flex-row justify-center items-start gap-8 relative max-w-5xl mx-auto px-4">
        {/* Connecting line for desktop */}
        <div className="hidden md:block absolute top-12 left-1/2 -translate-x-1/2 w-3/4 h-0.5 bg-neutral-200 -z-10"></div>

        {[
          { step: '01', title: 'Choose a Museum', desc: 'Browse our global network of partner museums.' },
          { step: '02', title: 'Explore Galleries', desc: 'Navigate curated rooms and virtual spaces.' },
          { step: '03', title: 'Discover Objects', desc: 'View high-resolution artifacts and 3D models.' },
          { step: '04', title: 'Interact & Learn', desc: 'Read stories, listen to audio, and take quizzes.' }
        ].map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center bg-white p-6 rounded-xl relative z-0">
            <div className="w-16 h-16 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xl font-bold mb-6 shadow-md shadow-neutral-200">
              {item.step}
            </div>
            <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
            <p className="text-sm text-neutral-500">{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default HowItWorks;
