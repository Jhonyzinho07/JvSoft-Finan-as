import { useState, useCallback, useEffect, createContext, useContext } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ─── Contexto global ────────────────────────────────────────────────
const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>')
  return ctx
}

// ─── Provider (envolve o App inteiro) ───────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Atalhos semânticos
  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error', dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info:    (msg, dur) => addToast(msg, 'info', dur),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

// ─── Container de toasts (canto superior direito) ────────────────────
function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  )
}

// ─── Item individual ─────────────────────────────────────────────────
const STYLES = {
  success: { bg: 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-800 dark:text-emerald-200', icon: <CheckCircle size={18} className="text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" /> },
  error:   { bg: 'bg-red-50 dark:bg-red-950/90 border-red-200 dark:border-red-800',                 text: 'text-red-800 dark:text-red-200',         icon: <XCircle     size={18} className="text-red-500 dark:text-red-400 shrink-0 mt-0.5" /> },
  warning: { bg: 'bg-amber-50 dark:bg-amber-950/90 border-amber-200 dark:border-amber-800',         text: 'text-amber-800 dark:text-amber-200',     icon: <AlertTriangle size={18} className="text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" /> },
  info:    { bg: 'bg-blue-50 dark:bg-slate-800 border-blue-200 dark:border-slate-600',              text: 'text-blue-800 dark:text-slate-200',      icon: <Info        size={18} className="text-blue-500 dark:text-cyan-400 shrink-0 mt-0.5" /> },
}

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false)
  const s = STYLES[toast.type] || STYLES.info

  useEffect(() => {
    // Pequeno delay pra ativar a animação de entrada
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg
        transition-all duration-300 ease-out
        ${s.bg} ${s.text}
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
    >
      {s.icon}
      <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity mt-0.5"
      >
        <X size={15} />
      </button>
    </div>
  )
}
