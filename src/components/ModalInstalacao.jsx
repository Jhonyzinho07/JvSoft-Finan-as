import { useState, useEffect } from 'react'
import { X, Download, Share, PlusSquare } from 'lucide-react'

export default function ModalInstalacao() {
  const [showModal, setShowModal] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    // 1. Verifica se já está instalado (rodando como app nativo)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    if (isStandalone) return

    // 2. Detecta se é iPhone/iPad (iOS)
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(isIosDevice)

    // Se for iOS, mostramos o modal didático logo de cara (caso ele não tenha dispensado antes)
    const avisoDispensado = localStorage.getItem('jvsoft_install_dismissed')
    if (isIosDevice && !avisoDispensado) {
      setTimeout(() => setShowModal(true), 3000) // Abre após 3 segundos
    }

    // 3. Captura o evento nativo de instalação do Android (Chrome)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e) // Salva o evento para disparar quando o usuário clicar no botão
      if (!avisoDispensado) {
        setShowModal(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  const fecharModal = () => {
    setShowModal(false)
    localStorage.setItem('jvsoft_install_dismissed', 'true') // Não incomoda o usuário novamente se ele fechar
  }

  const handleInstalarAndroid = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt() // Mostra a janelinha nativa do Google Chrome
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowModal(false)
      }
      setDeferredPrompt(null)
    }
  }

  if (!showModal) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden relative">
        <button onClick={fecharModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 rounded-full p-1 transition-colors">
          <X size={20} />
        </button>

        <div className="p-6 text-center">
          {/* Logo da pasta public — não muda com o tema */}
          <div className="w-20 h-20 mx-auto bg-slate-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center p-2 mb-4 shadow-inner border border-slate-100 dark:border-slate-600">
            <img src="/logo.png" alt="Logo JvSoft" className="w-full h-full object-contain" />
          </div>

          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Instale o App JvSoft</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Adicione o nosso aplicativo à sua tela inicial para um acesso mais rápido, tela cheia e controle total das suas finanças.
          </p>

          {isIOS ? (
            // INSTRUÇÕES PARA IPHONE (iOS)
            <div className="bg-blue-50 dark:bg-slate-700 text-blue-900 dark:text-cyan-100 text-sm p-4 rounded-2xl text-left border border-blue-100 dark:border-slate-600">
              <p className="font-semibold mb-3 flex items-center gap-2">Siga estes passos no seu iPhone:</p>
              <ol className="space-y-3">
                <li className="flex items-center gap-3">
                  <span className="bg-white p-1.5 rounded-lg shadow-sm dark:bg-slate-800"><Share size={18} className="text-blue-600" /></span>
                  <span>1. Toque no ícone de <strong>Compartilhar</strong> na barra inferior do Safari.</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="bg-white p-1.5 rounded-lg shadow-sm dark:bg-slate-800"><PlusSquare size={18} className="text-blue-600" /></span>
                  <span>2. Role para baixo e escolha <strong>Adicionar à Tela de Início</strong>.</span>
                </li>
              </ol>
            </div>
          ) : (
            // BOTÃO AUTOMÁTICO PARA ANDROID
            <button 
              onClick={handleInstalarAndroid}
              className="w-full bg-gradient-to-r from-blue-900 to-cyan-500 text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <Download size={24} />
              Instalar Agora
            </button>
          )}
        </div>
      </div>
    </div>
  )
}