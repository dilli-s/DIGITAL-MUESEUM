import React from 'react';
import { Box } from 'lucide-react';
import '@google/model-viewer';
import { getMediaUrl } from '../../utils/media';

const ModelViewer = ({ modelSrc }) => {
  if (!modelSrc) return null;

  return (
    <section className="mb-16">
      <div className="flex items-center mb-6">
        <Box className="w-6 h-6 text-neutral-900 mr-3" />
        <h2 className="text-2xl font-bold text-neutral-900">3D View</h2>
      </div>
      <div className="bg-neutral-100 rounded-2xl aspect-square md:aspect-video flex flex-col items-center justify-center border border-neutral-200 overflow-hidden">
        <model-viewer 
          src={getMediaUrl(modelSrc)}
          camera-controls 
          auto-rotate 
          shadow-intensity="1"
          style={{ width: '100%', height: '100%' }}
        ></model-viewer>
      </div>
    </section>
  );
};

export default ModelViewer;
