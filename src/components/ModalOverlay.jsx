import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Fundo escuro padrão dos modais.
 *
 * - Renderiza direto no <body> (portal): não herda o margin-top de pais com
 *   `space-y-*` nem fica preso a pais com transform/animação, então sempre
 *   cobre a tela inteira.
 * - O próprio fundo rola: se o modal for mais alto que a tela (celular
 *   pequeno ou teclado aberto), dá para rolar até o título e o botão de salvar.
 * - Trava a rolagem da página por trás enquanto estiver aberto.
 * - Respeita as áreas seguras do iPhone (notch / barra inicial).
 * - `onClose` (opcional) é chamado ao apertar Esc; com `fecharNoFundo`, também
 *   ao tocar fora do modal (use só em modais sem formulário, para não perder dados).
 */
export default function ModalOverlay({ children, onClose, fecharNoFundo = false, zIndex = 'z-50' }) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const aoTeclar = (e) => { if (e.key === 'Escape') onCloseRef.current?.() }
    window.addEventListener('keydown', aoTeclar)
    return () => {
      document.body.style.overflow = overflowAnterior
      window.removeEventListener('keydown', aoTeclar)
    }
  }, [])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 ${zIndex} overflow-y-auto overscroll-contain bg-slate-900/50 backdrop-blur-sm animate-fade-in`}
    >
      <div
        className="flex min-h-full items-center justify-center px-3 sm:px-4"
        onClick={fecharNoFundo ? (e) => { if (e.target === e.currentTarget) onCloseRef.current?.() } : undefined}
        style={{
          paddingTop: 'max(1rem, env(safe-area-inset-top))',
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}
