import React from 'react';
import { FileText } from 'lucide-react';

export const Loading = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
    <div className="text-center">
      <FileText className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);