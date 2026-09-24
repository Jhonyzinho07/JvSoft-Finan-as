import React from 'react';
import { X } from 'lucide-react';
import ModalOverlay from './ModalOverlay';

export default function ModalDocumento({ isOpen, onClose, titulo, children }) {
  if (!isOpen) return null;

  return (
    <ModalOverlay onClose={onClose} fecharNoFundo>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[85dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
            {titulo}
          </h2>
          <button
            onClick={onClose}
            className="p-2.5 -mr-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain custom-scrollbar flex-1">
          {children}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
