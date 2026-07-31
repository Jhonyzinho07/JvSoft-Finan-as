import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { useToast } from '../components/Toast'
import {
  User, LogOut, Shield, Bell, Moon, Sun, Loader2, AlertTriangle, Trash2,
  ChevronRight, KeyRound, Save, X, Check, Camera, BellOff, Monitor
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import ModalDocumento from '../components/ModalDocumento'
import { ConteudoTermosDeUso, ConteudoPoliticaPrivacidade } from '../components/DocumentosConteudo'

const TAMANHO_MAX_AVATAR = 3 * 1024 * 1024 // 3MB

function Toggle({ ativo, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!ativo)}
      className={`w-12 h-6 rounded-full relative transition-colors duration-200 focus:outline-none
        ${ativo ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-600'}`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200
        ${ativo ? 'right-1' : 'left-1'}`} />
    </button>
  )
}

export default function Configuracoes() {
  const toast = useToast()
  const { theme, setTheme } = useTheme()
  const inputAvatarRef = useRef(null)

  const [usuario, setUsuario]       = useState(null)
  const [loading, setLoading]       = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [modalSenha, setModalSenha] = useState(false)
  const [modalExcluirConta, setModalExcluirConta] = useState(false)
  const [loadingExcluir, setLoadingExcluir] = useState(false)

  // Prefs persistidas no localStorage
  const [notificacoes, setNotificacoes]         = useState(() => localStorage.getItem('pref_notif') !== 'false')
  const [alertaVencimento, setAlertaVencimento] = useState(() => localStorage.getItem('pref_alerta') !== 'false')
  const [permissaoNotif, setPermissaoNotif]     = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'))

  // Troca de senha
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova]   = useState('')
  const [senhaConf, setSenhaConf]   = useState('')

  // Perfil
  const [salvandoPerfil, setSalvandoPerfil] = useState(false)
  const [nome, setNome]                     = useState('')
  const [avatarUrl, setAvatarUrl]           = useState(null)
  const [avatarFile, setAvatarFile]         = useState(null)

  // Modais de documentos
  const [modalTermosOpen, setModalTermosOpen] = useState(false)
  const [modalPrivacidadeOpen, setModalPrivacidadeOpen] = useState(false)
  const [avatarPreview, setAvatarPreview]   = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUsuario(user)
      setNome(user?.user_metadata?.full_name || '')
      setAvatarUrl(user?.user_metadata?.avatar_url || null)
    })
  }, [])


  useEffect(() => { localStorage.setItem('pref_alerta', alertaVencimento) }, [alertaVencimento])

  // Ao ligar notificações, pede permissão do navegador (precisa ser em resposta a uma ação do usuário)
  const handleToggleNotificacoes = async (novoValor) => {
    setNotificacoes(novoValor)
    localStorage.setItem('pref_notif', novoValor)

    if (!novoValor) return
    if (!('Notification' in window)) {
      toast.warning('Seu navegador não suporta notificações. Os alertas continuam aparecendo dentro do app.')
      return
    }
    if (Notification.permission === 'default') {
      const permissao = await Notification.requestPermission()
      setPermissaoNotif(permissao)
      if (permissao === 'granted') {
        toast.success('Notificações ativadas!')
      } else {
        toast.warning('Permissão negada. Você ainda vai ver os alertas dentro do app.')
      }
    } else if (Notification.permission === 'denied') {
      toast.warning('As notificações estão bloqueadas nas permissões do navegador para este site.')
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    await supabase.auth.signOut()
  }

  // ── Perfil: nome + avatar ──────────────────────────────────────────
  const iniciais = (nome?.trim()
    ? nome.trim().split(' ').slice(0, 2).map(p => p[0]).join('')
    : usuario?.email?.substring(0, 2) || 'US'
  ).toUpperCase()

  const handleSelecionarAvatar = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.warning('Selecione um arquivo de imagem.')
      return
    }
    if (file.size > TAMANHO_MAX_AVATAR) {
      toast.warning('A imagem precisa ter até 3MB.')
      return
    }
    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const handleSalvarPerfil = async () => {
    setSalvandoPerfil(true)
    try {
      let novoAvatarUrl = avatarUrl

      if (avatarFile) {
        const extensao = avatarFile.name.split('.').pop()
        const caminho = `${usuario.id}/avatar.${extensao}`

        const { error: errorUpload } = await supabase.storage
          .from('avatars')
          .upload(caminho, avatarFile, { upsert: true, cacheControl: '3600' })
        if (errorUpload) throw errorUpload

        const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(caminho)
        // Adiciona um parâmetro de versão pra forçar a atualização do cache da imagem
        novoAvatarUrl = `${publicData.publicUrl}?v=${Date.now()}`
      }

      const { error: errorUpdate } = await supabase.auth.updateUser({
        data: { full_name: nome.trim(), avatar_url: novoAvatarUrl }
      })
      if (errorUpdate) throw errorUpdate

      setAvatarUrl(novoAvatarUrl)
      setAvatarFile(null)
      setAvatarPreview(null)
      toast.success('Perfil atualizado com sucesso!')
    } catch (err) {
      console.error('Erro ao salvar perfil:', err)
      toast.error(err.message || 'Não foi possível salvar o perfil.')
    } finally {
      setSalvandoPerfil(false)
    }
  }

  // ── Troca de senha (exige a senha atual) ────────────────────────────

  const handleExcluirConta = async () => {
    setLoadingExcluir(true)
    try {
      const { error } = await supabase.rpc('delete_user')
      if (error) throw error

      await supabase.auth.signOut()
      window.location.href = '/'
    } catch (error) {
      toast.error('Erro ao excluir conta. Tente novamente mais tarde.')
      console.error(error)
      setLoadingExcluir(false)
      setModalExcluirConta(false)
    }
  }

  const handleTrocarSenha = async (e) => {
    e.preventDefault()
    if (!senhaAtual) {
      toast.warning('Informe sua senha atual.')
      return
    }
    if (senhaNova !== senhaConf) {
      toast.warning('As senhas não coincidem.')
      return
    }
    if (senhaNova.length < 6) {
      toast.warning('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }
    setSalvando(true)
    try {
      // 1. Confirma a senha atual tentando autenticar de novo com ela
      const { error: errorReauth } = await supabase.auth.signInWithPassword({
        email: usuario.email,
        password: senhaAtual
      })
      if (errorReauth) {
        toast.error('Senha atual incorreta.')
        setSalvando(false)
        return
      }

      // 2. Só troca a senha depois de confirmar a atual
      const { error } = await supabase.auth.updateUser({ password: senhaNova })
      if (error) throw error
      toast.success('Senha alterada com sucesso!')
      setModalSenha(false)
      setSenhaAtual(''); setSenhaNova(''); setSenhaConf('')
    } catch (err) {
      toast.error(err.message || 'Erro ao trocar a senha.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto pb-28 space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-900 to-cyan-500 flex items-center justify-center">
          <Shield size={17} className="text-white" />
        </div>
        <div>
          <h1 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg leading-tight">Configurações</h1>
          <p className="text-slate-400 dark:text-slate-500 text-xs">Gerencie sua conta e preferências</p>
        </div>
      </div>

      {/* Perfil */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 transition-colors">
        <h2 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
          <User size={16} className="text-blue-600" /> Perfil
        </h2>

        <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-slate-700 dark:to-slate-700 rounded-2xl border border-blue-100 dark:border-slate-600">
          <button
            type="button"
            onClick={() => inputAvatarRef.current?.click()}
            className="relative w-16 h-16 shrink-0 rounded-2xl group"
            title="Alterar foto"
          >
            {(avatarPreview || avatarUrl) ? (
              <img
                src={avatarPreview || avatarUrl}
                alt="Avatar"
                className="w-16 h-16 rounded-2xl object-cover shadow-md"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-900 to-cyan-500 rounded-2xl flex items-center justify-center text-white font-extrabold text-xl shadow-md">
                {iniciais}
              </div>
            )}
            <div className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
              <Camera size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
          <input
            ref={inputAvatarRef}
            type="file"
            accept="image/*"
            onChange={handleSelecionarAvatar}
            className="hidden"
          />

          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              className="w-full bg-transparent font-bold text-slate-800 dark:text-slate-100 outline-none border-b border-transparent focus:border-blue-400 pb-0.5 truncate"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{usuario?.email || 'Carregando...'}</p>
          </div>
        </div>

        {(nome !== (usuario?.user_metadata?.full_name || '') || avatarFile) && (
          <button
            onClick={handleSalvarPerfil}
            disabled={salvandoPerfil}
            className="mt-3 w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-semibold disabled:opacity-60"
          >
            {salvandoPerfil ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Salvar perfil
          </button>
        )}

        {/* Botão trocar senha */}
        <button
          onClick={() => setModalSenha(true)}
          className="mt-4 w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-600 transition-colors group"
        >
          <span className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <KeyRound size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
            Alterar senha
          </span>
          <ChevronRight size={16} className="text-slate-300 dark:text-slate-500 group-hover:text-blue-400 transition-colors" />
        </button>
      </div>

      {/* Preferências */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 transition-colors">
        <h2 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-4 flex items-center gap-2">
          <Bell size={16} className="text-blue-600" /> Preferências
        </h2>
        <div className="space-y-1">

          <div className="py-3.5 px-2 rounded-xl transition-colors flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Moon size={18} className="text-slate-500 dark:text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aparência</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Escolha o tema do aplicativo</p>
              </div>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-full mx-auto sm:mx-0">
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${theme === 'light' ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
              >
                <Sun size={16} /> Claro
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${theme === 'dark' ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
              >
                <Moon size={16} /> Escuro
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${theme === 'system' ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
              >
                <Monitor size={16} /> Sistema
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-3.5 px-2 rounded-xl transition-colors">
            <div className="flex items-center gap-3">
              {notificacoes ? <Bell size={18} className="text-slate-500 dark:text-slate-400" /> : <BellOff size={18} className="text-slate-500 dark:text-slate-400" />}
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Notificações</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {permissaoNotif === 'denied'
                    ? 'Bloqueadas nas permissões do navegador'
                    : permissaoNotif === 'unsupported'
                    ? 'Navegador não suporta — alertas só dentro do app'
                    : 'Receber alertas do sistema no navegador'}
                </p>
              </div>
            </div>
            <Toggle ativo={notificacoes} onChange={handleToggleNotificacoes} />
          </div>

          <div className="flex items-center justify-between py-3.5 px-2 rounded-xl transition-colors">
            <div className="flex items-center gap-3">
              <Sun size={18} className="text-slate-500 dark:text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Alertas de Vencimento</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Destacar contas vencidas/a vencer no Dashboard</p>
              </div>
            </div>
            <Toggle ativo={alertaVencimento} onChange={setAlertaVencimento} />
          </div>

        </div>
      </div>

      {/* Informações do app */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 transition-colors">
        <h2 className="font-bold text-slate-700 dark:text-slate-200 text-sm mb-4">Sobre o App</h2>
        <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <button onClick={() => setModalTermosOpen(true)} className="w-full flex items-center justify-between p-3 rounded-xl transition-colors group">
                <div className="flex items-center gap-3"><span className="text-slate-700 dark:text-slate-200">Termos de Uso</span></div>
                <ChevronRight size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
              </button>
              <button onClick={() => setModalPrivacidadeOpen(true)} className="w-full flex items-center justify-between p-3 rounded-xl transition-colors group">
                <div className="flex items-center gap-3"><span className="text-slate-700 dark:text-slate-200">Política de Privacidade</span></div>
                <ChevronRight size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
              </button>
          <div className="flex justify-between"><span>Versão</span><span className="font-semibold text-slate-700 dark:text-slate-200">1.0.0</span></div>
          <div className="flex justify-between"><span>Desenvolvido por</span><span className="font-semibold text-slate-700 dark:text-slate-200">JVSoft</span></div>
        </div>
      </div>


      {/* Botões de Ação Perigosa */}
      <div className="flex flex-col gap-4">
        {/* Logout */}
        <button
          onClick={handleLogout}
          disabled={loading || loadingExcluir}
          className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl font-bold hover:bg-red-100 dark:hover:bg-red-950/60 transition-all border border-red-100 dark:border-red-900/50"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} />}
          {loading ? 'Saindo...' : 'Encerrar Sessão'}
        </button>

        {/* Excluir Conta */}
        <button
          onClick={() => setModalExcluirConta(true)}
          disabled={loading || loadingExcluir}
          className="w-full flex items-center justify-center gap-3 p-4 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 rounded-2xl font-bold hover:bg-red-50 dark:hover:bg-slate-700 transition-all border border-red-200 dark:border-red-900/50"
        >
          <Trash2 size={20} />
          Excluir Minha Conta
        </button>
      </div>

      {/* Modal Excluir Conta */}
      {modalExcluirConta && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-6 border border-red-100 dark:border-red-900/30">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Atenção!</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Tem certeza que deseja excluir sua conta? Esta ação é irreversível e apagará todos os seus dados e registros financeiros permanentemente.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalExcluirConta(false)}
                disabled={loadingExcluir}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleExcluirConta}
                disabled={loadingExcluir}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loadingExcluir ? <Loader2 size={18} className="animate-spin" /> : 'Excluir Conta'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Modal troca de senha */}
      {modalSenha && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-900 to-cyan-500 px-6 py-4 flex items-center justify-between text-white">
              <h2 className="font-bold text-lg flex items-center gap-2"><KeyRound size={18} /> Alterar Senha</h2>
              <button onClick={() => setModalSenha(false)} className="p-2 hover:bg-white/20 rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleTrocarSenha} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Senha Atual</label>
                <input type="password" required value={senhaAtual}
                  onChange={e => setSenhaAtual(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
                  placeholder="Digite sua senha atual" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nova Senha</label>
                <input type="password" required minLength={6} value={senhaNova}
                  onChange={e => setSenhaNova(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900"
                  placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirmar Nova Senha</label>
                <input type="password" required value={senhaConf}
                  onChange={e => setSenhaConf(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 transition-colors
                    ${senhaConf && senhaNova !== senhaConf
                      ? 'border-red-300 dark:border-red-700 focus:border-red-400 focus:ring-red-100 dark:focus:ring-red-900'
                      : 'border-slate-200 dark:border-slate-600 focus:border-blue-500 focus:ring-blue-100 dark:focus:ring-blue-900'}`}
                  placeholder="Repita a nova senha" />
                {senhaConf && senhaNova !== senhaConf && (
                  <p className="text-xs text-red-500 mt-1">As senhas não coincidem.</p>
                )}
                {senhaConf && senhaNova === senhaConf && senhaConf.length >= 6 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1"><Check size={12} /> Senhas coincidem!</p>
                )}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalSenha(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando || senhaNova !== senhaConf}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-bold flex justify-center items-center gap-2 disabled:opacity-50">
                  {salvando ? <Loader2 size={18} className="animate-spin" /> : <><Save size={16} /> Salvar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modais de Termos e Privacidade */}
      <ModalDocumento
        isOpen={modalTermosOpen}
        onClose={() => setModalTermosOpen(false)}
        titulo="Termos de Uso"
      >
        <ConteudoTermosDeUso />
      </ModalDocumento>

      <ModalDocumento
        isOpen={modalPrivacidadeOpen}
        onClose={() => setModalPrivacidadeOpen(false)}
        titulo="Política de Privacidade"
      >
        <ConteudoPoliticaPrivacidade />
      </ModalDocumento>
    </div>
  )
}
