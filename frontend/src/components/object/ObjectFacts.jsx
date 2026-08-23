import React from 'react';
import { CheckCircle2 } from 'lucide-react';

const ObjectFacts = ({ facts }) => {
  if (!facts || facts.length === 0) return null;

  return (
    <section className="mb-16">
      <h2 className="text-2xl font-bold text-neutral-900 mb-6">Interesting Facts</h2>
      <ul className="space-y-4">
        {facts.map((fact, index) => (
          <li key={index} className="flex bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
            <CheckCircle2 className="w-6 h-6 text-neutral-900 mr-4 flex-shrink-0 mt-0.5" />
            <span className="text-neutral-700 leading-relaxed">{fact}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ObjectFacts;
