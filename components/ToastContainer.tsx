import React, { useEffect, useState } from 'react';
import type { ToastMessage, ToastType } from '../types';
import { CheckIcon, XMarkIcon, InformationCircleIcon } from './Icons';

// --- ToastItem: The individual toast component ---
interface ToastItemProps {
  toast: ToastMessage;
  onClose: (id: number) => void;
}

const ICONS: Record<ToastType, React.FC<{className?: string}>> = {
  success: CheckIcon,
  error: XMarkIcon,
  info: InformationCircleIcon,
};

const COLORS = {
  success: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800' },
  error: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-800' },
  info: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800' },
};

const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  
  // Auto-dismiss timer
  useEffect(() => {
    const timerId = setTimeout(handleClose, 5000);
    return () => clearTimeout(timerId);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    // Wait for animation to finish before removing from parent state
    setTimeout(() => onClose(toast.id), 300); 
  };
  
  const Icon = ICONS[toast.type];
  const color = COLORS[toast.type];
  const animationClasses = isExiting ? 'animate-fade-out' : 'animate-fade-in-right';

  return (
    <div
      className={`relative w-full max-w-sm rounded-lg shadow-lg pointer-events-auto p-4 border-l-4 ${color.bg} ${color.border} ${animationClasses}`}
      role="alert"
    >
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Icon className={`w-6 h-6 ${color.text}`} aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1 pt-0.5">
          <p className={`text-sm font-medium ${color.text}`}>{toast.message}</p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            className={`inline-flex rounded-md p-1 ${color.bg} text-slate-500 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
            onClick={handleClose}
          >
            <span className="sr-only">Đóng</span>
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

// --- ToastContainer: The component that holds all toasts ---
interface ToastContainerProps {
    toasts: ToastMessage[];
    removeToast: (id: number) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
    return (
        <>
            <div 
                aria-live="assertive"
                className="fixed inset-0 flex items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-50"
            >
                <div className="w-full flex flex-col items-center space-y-4 sm:items-end">
                    {toasts.map((toast) => (
                        <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
                    ))}
                </div>
            </div>
            {/* Injecting animation styles directly to avoid needing a CSS file */}
            <style>{`
                @keyframes fade-in-right {
                    from { opacity: 0; transform: translateX(100%); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-fade-in-right { animation: fade-in-right 0.4s ease-out forwards; }
                
                @keyframes fade-out {
                    from { opacity: 1; transform: scale(1); }
                    to { opacity: 0; transform: scale(0.9); }
                }
                .animate-fade-out { animation: fade-out 0.3s ease-in forwards; }
            `}</style>
        </>
    );
};

export default ToastContainer;
