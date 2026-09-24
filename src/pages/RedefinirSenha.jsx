import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Loader2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useToast } from '../components/Toast'

// Mesmas regras usadas no cadastro (Login.jsx)
function validarSenha(senha) {
  if (senha.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/\d/.test(senha)) return 'A senha deve conter pelo menos um número.'
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(senha)) return 'A senha deve conter pelo menos um caractere especial.'
  return null
}

/**
 * Destino do link "Esqueci minha senha" (redirectTo: /reset-password).
 * Ao abrir o link, o Supabase já cria a sessão de recuperação; aqui o
 * usuário só define a nova senha.
 */
export default function RedefinirSenha() {
  const toast = useToast()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const problema = validarSenha(senha)
    if (problema) return setErro(problema)
    if (senha !== confirmacao) return setErro('As senhas não conferem.')

    setErro('')
    setSalvando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSalvando(false)

    if (error) {
      setErro('Não foi possível redefinir a senha. O link pode ter expirado — peça um novo na tela de login.')
      return
    }
    toast.success('Senha redefinida com sucesso!')
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="p-4 md:p-8 max-w-md mx-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <KeyRound size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Redefinir senha</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Escolha uma nova senha para sua conta.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Nova senha</label>
            <input type="password" required autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Confirmar nova senha</label>
            <input type="password" required autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Mínimo de 8 caracteres, com pelo menos um número e um caractere especial.</p>

          {erro && <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>}

          <button type="submit" disabled={salvando}
            className="w-full py-3.5 text-white rounded-xl font-bold shadow-lg bg-gradient-to-r from-blue-900 to-cyan-500 disabled:opacity-70">
            {salvando ? <Loader2 className="animate-spin mx-auto" /> : 'Salvar nova senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
