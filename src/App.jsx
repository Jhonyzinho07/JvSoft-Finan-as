import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import { ToastProvider, useToast } from './components/Toast'
import { useAlertasVencimento } from './hooks/useAlertasVencimento'
import { Plus } from 'lucide-react'

// Componentes que carregam SEMPRE (parte do shell do app)
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import ModalTransacao from './components/ModalTransacao'
import ModalInstalacao from './components/ModalInstalacao'

// Páginas carregadas sob demanda (code splitting)
// Cada rota vira um chunk separado — o bundle inicial cai de 1.6MB para ~250KB
const Dashboard       = lazy(() => import('./Dashboard'))
const ContasPagar     = lazy(() => import('./ContasPagar'))
const MetasFinanceiras = lazy(() => import('./pages/MetasFinanceiras'))
const Login           = lazy(() => import('./pages/Login'))
const Transacoes      = lazy(() => import('./pages/Transacoes'))
const CartoesCredito  = lazy(() => import('./pages/CartoesCredito'))
const Orcamentos      = lazy(() => import('./pages/Orcamentos'))
const Relatorios      = lazy(() => import('./pages/Relatorios'))
const Configuracoes   = lazy(() => import('./pages/Configuracoes'))

// Spinner reutilizado enquanto a rota carrega
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
}

function AppContent() {
  const [modalAberto, setModalAberto] = useState(false)
  const [tipoTransacao, setTipoTransacao] = useState('despesa')
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const location = useLocation()
  const toast = useToast()

  // Verifica contas vencidas/a vencer uma vez por dia (respeita as prefs de Configurações)
  useAlertasVencimento(usuario, toast)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUsuario(session?.user ?? null)
      setCarregando(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  if (!usuario) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50"><div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /></div>}>
        <Login />
      </Suspense>
    )
  }

  // Layout Base da Aplicação (Sidebar + Conteúdo Dinâmico)
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      <Sidebar telaAtual={location.pathname.replace('/', '')} setUsuario={setUsuario} />
      
      <main className="flex-1 overflow-auto relative pb-20 lg:pb-0">
        
        {/* Header Mobile Otimizado (com a sua Logo oficial) */}
        <header className="lg:hidden bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b border-blue-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo JvSoft" className="w-8 h-8 object-contain rounded-lg shadow-sm" />
            <span className="font-bold text-gray-800 dark:text-slate-100">JvSoft</span>
          </div>
          <button
            onClick={() => setModalAberto(true)}
            className="p-2 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-lg shadow-md"
          >
            <Plus size={20} />
          </button>
        </header>

        {/* Rotas com carregamento sob demanda */}
        <div className="py-6">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/contas" element={<ContasPagar />} />
              <Route path="/metas" element={<MetasFinanceiras />} />
              <Route path="/transacoes" element={<Transacoes />} />
              <Route path="/cartoes" element={<CartoesCredito />} />
              <Route path="/orcamento" element={<Orcamentos />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      {/* Botão Flutuante Desktop */}
      <button
        onClick={() => {
          setTipoTransacao('despesa')
          setModalAberto(true)
        }}
        className="hidden lg:flex fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-full shadow-2xl items-center justify-center hover:from-blue-800 hover:to-cyan-400 transition-all hover:scale-110 z-40"
      >
        <Plus size={28} />
      </button>
      
      {modalAberto && (
        <ModalTransacao 
          onClose={() => setModalAberto(false)} 
          tipoInicial={tipoTransacao} 
        />
      )}

      {/* Navegação mobile: substitui a Sidebar (hidden lg:flex) quando a tela é pequena */}
      <BottomNav setUsuario={setUsuario} />

      {/* Componente Inteligente de Instalação do PWA */}
      <ModalInstalacao />
      
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  )
}