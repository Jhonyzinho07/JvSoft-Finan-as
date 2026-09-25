import { useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { carregarAvisoBanco } from './AvisoBanco'
import {
  LayoutDashboard,
  Receipt,
  Target,
  CreditCard,
  MoreHorizontal,
  ArrowRightLeft,
  PieChart,
  BarChart2,
  Settings,
  Landmark,
  LogOut
} from 'lucide-react'

export default function BottomNav({ setUsuario }) {
  const [showMais, setShowMais] = useState(false)
  const navigate = useNavigate()

  // Mesma queryKey do AvisoBanco (Dashboard): reaproveita o cache do React Query
  // em vez de disparar outra consulta para o badge de pendentes.
  const { data: avisoBanco } = useQuery({
    queryKey: ['aviso-banco'],
    queryFn: carregarAvisoBanco,
    staleTime: 60 * 1000,
  })
  const pendentesBanco = avisoBanco?.pendentes || 0

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUsuario(null)
    navigate('/')
  }

  // Os 4 itens mais usados no dia a dia ficam fixos na barra
  const itensPrincipais = [
    { path: '/dashboard', icone: LayoutDashboard, label: 'Início' },
    { path: '/contas', icone: Receipt, label: 'Contas' },
    { path: '/metas', icone: Target, label: 'Metas' },
    { path: '/cartoes', icone: CreditCard, label: 'Cartões' },
  ]

  // O resto vai numa gaveta ("Mais") que abre de baixo pra cima
  const itensMais = [
    { path: '/transacoes', icone: ArrowRightLeft, label: 'Transações' },
    { path: '/orcamento', icone: PieChart, label: 'Orçamentos' },
    { path: '/relatorios', icone: BarChart2, label: 'Relatórios' },
    { path: '/importacoes', icone: Landmark, label: 'Importações', badge: pendentesBanco },
    { path: '/configuracoes', icone: Settings, label: 'Configurações' },
  ]

  const linkClasses = ({ isActive }) =>
    `flex flex-col items-center justify-center gap-0.5 transition-colors ${
      isActive ? 'text-blue-900 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'
    }`

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-blue-100 dark:border-slate-700 z-40 pb-safe">
        <div className="grid grid-cols-5 h-16">
          {itensPrincipais.map((item) => (
            <NavLink key={item.path} to={item.path} className={linkClasses}>
              <item.icone size={22} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setShowMais(true)}
            className="flex flex-col items-center justify-center gap-0.5 text-slate-400"
          >
            <MoreHorizontal size={22} />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </div>
      </nav>

      {/* Gaveta "Mais" - Portal garante que fica por cima de tudo, sem depender do container pai */}
      {showMais && createPortal(
        <div
          className="lg:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-end animate-fade-in"
          onClick={() => setShowMais(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 w-full rounded-t-3xl p-4 pb-8"
            style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full mx-auto mb-5" />
            <div className="grid grid-cols-4 gap-3 mb-4">
              {itensMais.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMais(false)}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-colors ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-900 to-cyan-500 text-white shadow-md'
                        : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`
                  }
                >
                  <span className="relative">
                    <item.icone size={22} />
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                </NavLink>
              ))}
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 font-semibold"
            >
              <LogOut size={18} /> Sair da conta
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
