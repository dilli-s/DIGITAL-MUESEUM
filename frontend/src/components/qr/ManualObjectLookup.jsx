import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getObject, getObjectByCode } from '../../services/api';
import { Search, RefreshCw } from 'lucide-react';

const ManualObjectLookup = () => {
  const [objectCode, setObjectCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLookup = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedCode = objectCode.trim();

    if (!trimmedCode) {
      setError('Please enter an object code.');
      return;
    }

    setIsLoading(true);
    
    try {
      let obj;
      // First try to look up by exact ID, then by code
      try {
         obj = await getObject(trimmedCode);
      } catch (err1) {
         try {
            obj = await getObjectByCode(trimmedCode);
         } catch (err2) {
            throw err2; // Both failed
         }
      }
      
      navigate(`/objects/${obj.id}`);
      
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError('Object not found. Please check the code and try again.');
      } else {
        setError('Unable to reach the database. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-neutral-50 rounded-2xl p-6 md:p-8 border border-neutral-200">
      <h2 className="text-xl font-bold text-neutral-900 mb-2">Enter Object Code</h2>
      <p className="text-neutral-600 mb-6">If you cannot scan the QR code, enter the ID manually.</p>
      
      <form onSubmit={handleLookup} className="space-y-4">
        <div>
          <label htmlFor="object-code" className="sr-only">Object ID</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-neutral-400" />
            </div>
            <input
              id="object-code"
              type="text"
              disabled={isLoading}
              className="block w-full pl-10 pr-3 py-3 border border-neutral-300 rounded-lg leading-5 bg-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-900 focus:border-neutral-900 sm:text-sm"
              placeholder="e.g. 1"
              value={objectCode}
              onChange={(e) => setObjectCode(e.target.value)}
            />
          </div>
          {error && <p className="mt-2 text-sm text-red-600" aria-live="polite">{error}</p>}
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-neutral-900 hover:bg-neutral-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'FIND OBJECT'}
        </button>
      </form>
    </div>
  );
};

export default ManualObjectLookup;
