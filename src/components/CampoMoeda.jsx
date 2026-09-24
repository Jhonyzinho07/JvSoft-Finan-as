import { mascararMoeda } from '../utils/moeda'

/**
 * Campo de valor em Real: "R$" fixo à esquerda e digitação em centavos
 * (1 → 0,01, 123 → 1,23). `value` é o texto formatado ("1.234,56");
 * converta com moedaParaNumero() ao salvar e preencha com numeroParaMoeda().
 * Abre o teclado numérico no celular.
 */
export default function CampoMoeda({ value, onChange, grande = false, className = '', ...props }) {
  const base = grande
    ? 'pl-14 pr-4 py-4 rounded-2xl font-bold text-3xl text-center'
    : 'pl-11 pr-4 py-3 rounded-xl font-semibold'
  return (
    <div className="relative">
      <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 pointer-events-none ${grande ? 'text-xl' : ''}`}>R$</span>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="0,00"
        value={value}
        onChange={(e) => onChange(mascararMoeda(e.target.value))}
        className={`w-full ${base} border border-slate-200 outline-none bg-white text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-blue-900 disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400 ${className}`}
        {...props}
      />
    </div>
  )
}
