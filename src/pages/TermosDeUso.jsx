import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { ConteudoTermosDeUso } from '../components/DocumentosConteudo';

export default function TermosDeUso() {
  const goBack = () => {
    window.history.back();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-6 md:p-12 font-sans">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-8"
        >
          <ArrowLeft size={20} />
          Voltar
        </button>

        <h1 className="text-3xl font-bold mb-6 text-slate-900 dark:text-white">Termos de Uso</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Última atualização: {new Date().toLocaleDateString('pt-BR')}</p>

        <ConteudoTermosDeUso />
      </div>
    </div>
  );
}
