import React from 'react';
import { Box } from 'lucide-react';

const ModelViewer = ({ modelSrc }) => {
  if (!modelSrc) return null;

  return (
    <section className="mb-16">
      <div className="flex items-center mb-6">
        <Box className="w-6 h-6 text-neutral-900 mr-3" />
        <h2 className="text-2xl font-bold text-neutral-900">3D View</h2>
      </div>
      <div className="bg-neutral-100 rounded-2xl aspect-square md:aspect-video flex flex-col items-center justify-center border border-neutral-200 border-dashed text-center p-8">
        <Box className="w-16 h-16 text-neutral-400 mb-4" />
        <p className="text-neutral-900 font-medium text-lg mb-2">Interactive 3D model will be available here.</p>
        <p className="text-neutral-500 text-sm max-w-md">
          (Phase 7 Placeholder. Future integration with Three.js or React Three Fiber will render {modelSrc})
        </p>
      </div>
    </section>
  );
};

export default ModelViewer;
