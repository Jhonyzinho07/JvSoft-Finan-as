import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import logoEmpresa from '../assets/logo.png'
import { 
  LayoutDashboard, 
  Receipt, 
  Target, 
  ArrowRightLeft, 
  CreditCard, 
  PieChart, 
  BarChart2, 
  Settings, 
  LogOut
} from 'lucide-react'

export default function Sidebar({ setUsuario }) {
  const navigate = useNavigate()

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
  ]

  return (
    <aside className="w-64 bg-card border-r border-border hidden lg:flex flex-col shadow-minimal transition-colors">
      {/* Cabeçalho do Sidebar (Logo — não muda com o tema) */}
      <div className="p-6 flex items-center gap-3">
        <img 
          src={logoEmpresa} 
          alt="Logo JvSoft" 
          className="w-12 h-12 object-contain drop-shadow-sm" 
        />
        <div>
          <h1 className="font-bold text-xl text-card-foreground">JvSoft</h1>
          <p className="text-xs text-muted-foreground font-medium">Finanças Pessoais</p>
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
                  ? 'bg-accent text-accent-foreground shadow-subtle'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <item.icone 
              size={20} 
              className="transition-transform group-hover:scale-110" 
            />
            <span className="font-medium text-sm">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Rodapé do Sidebar (Configurações e Logout) */}
      <div className="p-4 border-t border-border space-y-1.5">
        <NavLink
          to="/configuracoes"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              isActive
                ? 'bg-accent text-accent-foreground shadow-subtle'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`
          }
        >
          <Settings size={20} className="transition-transform group-hover:rotate-90" />
          <span className="font-medium text-sm">Configurações</span>
        </NavLink>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
        >
          <LogOut size={20} />
          <span className="font-medium text-sm">Sair da conta</span>
        </button>
      </div>
    </aside>
  )
}