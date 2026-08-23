import React from 'react';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <h1 className="text-3xl font-bold mb-4 text-neutral-900">404</h1>
      <p className="text-neutral-600 mb-2">Page Not Found</p>
      <a href="/" className="mt-4 text-blue-600 hover:underline">Return Home</a>
    </div>
  );
};

export default NotFound;
