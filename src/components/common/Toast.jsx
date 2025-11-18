import React from 'react';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

export const ToastContainer = ({ toasts }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2">
    {toasts.map(toast => (
      <div
        key={toast.id}
        className={`px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slideIn ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 
          toast.type === 'error' ? 'bg-red-600 text-white' : 
          'bg-blue-600 text-white'
        }`}
      >
        {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : 
         toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
         <Clock className="w-5 h-5" />}
        {toast.message}
      </div>
    ))}
  </div>
);