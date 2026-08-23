import React from 'react';
import { BookOpen, Layers, Lightbulb } from 'lucide-react';

const DiscoverySection = () => {
  return (
    <section className="py-16 bg-neutral-900 text-white rounded-2xl px-6 sm:px-12 my-8">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Discover More</h2>
        <p className="mt-2 text-neutral-400">Deepen your knowledge through interactive features.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 text-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-6">
            <Layers className="w-8 h-8 text-neutral-300" />
          </div>
          <h3 className="text-xl font-semibold mb-3">Related Objects</h3>
          <p className="text-neutral-400">Find objects connected to what you are exploring through advanced curation.</p>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-6">
            <BookOpen className="w-8 h-8 text-neutral-300" />
          </div>
          <h3 className="text-xl font-semibold mb-3">Stories & Themes</h3>
          <p className="text-neutral-400">Explore historical and cultural stories behind collections and civilizations.</p>
        </div>

        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mb-6">
            <Lightbulb className="w-8 h-8 text-neutral-300" />
          </div>
          <h3 className="text-xl font-semibold mb-3">Interactive Learning</h3>
          <p className="text-neutral-400">Test what you discover through quizzes, educational activities, and guides.</p>
        </div>
      </div>
    </section>
  );
};

export default DiscoverySection;
