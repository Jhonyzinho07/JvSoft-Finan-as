import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { carregarAvisoBanco } from './AvisoBanco'
import logoEmpresa from '../assets/logo-256.png' // versão leve (256px) — a original de 1024px pesava 300 KB
import {
  LayoutDashboard,
  Receipt,
  Target,
  ArrowRightLeft,
  CreditCard,
  PieChart,
  BarChart2,
  Landmark,
  Settings,
  LogOut
} from 'lucide-react'

export default function Sidebar({ setUsuario }) {
  const navigate = useNavigate()

  // Mesma queryKey do AvisoBanco (Dashboard): reaproveita o cache do React Query
  // em vez de disparar outra consulta só para o badge de pendentes.
  const { data: avisoBanco } = useQuery({
    queryKey: ['aviso-banco'],
    queryFn: carregarAvisoBanco,
    staleTime: 60 * 1000,
  })
  const pendentesBanco = avisoBanco?.pendentes || 0

  // Função centralizada para fazer logout com segurança
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUsuario(null)
    navigate('/')
  }

  // ARRAY DE ROTAS: Isso é um padrão "Enterprise" (DRY - Don't Repeat Yourself).
  // Em vez de copiar e colar o código de 8 botões, nós criamos uma lista e o React desenha.
  const menuItems = [
    { path: '/dashboard', icone: LayoutDashboard, label: 'Dashboard' },
    { path: '/contas', icone: Receipt, label: 'Contas a Pagar' },
    { path: '/metas', icone: Target, label: 'Metas Financeiras' },
    { path: '/transacoes', icone: ArrowRightLeft, label: 'Transações' },
    { path: '/cartoes', icone: CreditCard, label: 'Cartões' },
    { path: '/orcamento', icone: PieChart, label: 'Orçamentos' },
    { path: '/relatorios', icone: BarChart2, label: 'Relatórios' },
    { path: '/importacoes', icone: Landmark, label: 'Importações', badge: pendentesBanco },
  ]

  return (
    <aside className="w-64 bg-white dark:bg-slate-800 border-r border-blue-100 dark:border-slate-700 hidden lg:flex flex-col shadow-soft transition-colors">
      {/* Cabeçalho do Sidebar (Logo — não muda com o tema) */}
      <div className="p-6 flex items-center gap-3">
        <img 
          src={logoEmpresa} 
          alt="Logo JvSoft" 
          className="w-12 h-12 object-contain drop-shadow-sm" 
        />
        <div>
          <h1 className="font-bold text-xl text-slate-800 dark:text-slate-100">JvSoft</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Finanças Pessoais</p>
        </div>
      </div>

      {/* Corpo do Sidebar (Links de Navegação) */}
      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            // O NavLink passa um objeto { isActive } que diz se a URL atual bate com o "to"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-blue-900 to-cyan-500 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-900 dark:hover:text-cyan-400'
              }`
            }
          >
            <item.icone
              size={20}
              className="transition-transform group-hover:scale-110"
            />
            <span className="font-medium text-sm flex-1">{item.label}</span>
            {item.badge > 0 && (
              <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Rodapé do Sidebar (Configurações e Logout) */}
      <div className="p-4 border-t border-blue-50 dark:border-slate-700 space-y-1.5">
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              isActive
                ? 'bg-gradient-to-r from-blue-900 to-cyan-500 text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-900 dark:hover:text-cyan-400'
            }`
          }
        >
          <Settings size={20} className="transition-transform group-hover:rotate-90" />
          <span className="font-medium text-sm">Configurações</span>
        </NavLink>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all duration-200"
        >
          <LogOut size={20} />
          <span className="font-medium text-sm">Sair da conta</span>
        </button>
      </div>
    </aside>
  )
}