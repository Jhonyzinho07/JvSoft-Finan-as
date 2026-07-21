import { useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { formatarMoeda } from '../utils/helpers'

const DIAS_ANTECEDENCIA = 2 // mesma janela usada no Dashboard ("vence em breve")
const CHAVE_ULTIMA_VERIFICACAO = 'jvsoft_ultima_verificacao_alerta'

/**
 * Roda uma vez por dia (por navegador) quando o usuário está logado.
 * Se "Alertas de Vencimento" estiver ativo, busca contas vencidas ou que
 * vencem nos próximos dias. Se "Notificações" também estiver ativo, dispara
 * uma notificação nativa do navegador. Sempre mostra um toast in-app como
 * fallback (funciona mesmo sem permissão de notificação concedida).
 */
export function useAlertasVencimento(usuario, toast) {
  useEffect(() => {
    if (!usuario) return

    const alertaAtivo = localStorage.getItem('pref_alerta') !== 'false'
    if (!alertaAtivo) return

    // Só verifica uma vez por dia, pra não repetir o alerta a cada navegação
    const hojeStr = new Date().toISOString().split('T')[0]
    if (localStorage.getItem(CHAVE_ULTIMA_VERIFICACAO) === hojeStr) return

    const verificar = async () => {
      const dataAtual = new Date()
      dataAtual.setHours(0, 0, 0, 0)
      const limite = new Date(dataAtual)
      limite.setDate(dataAtual.getDate() + DIAS_ANTECEDENCIA)

      const { data: contas, error } = await supabase
        .from('contas')
        .select('descricao, valor, data_vencimento')
        .eq('status_pago', false)
        .lte('data_vencimento', limite.toISOString().split('T')[0])

      if (error || !contas) return

      localStorage.setItem(CHAVE_ULTIMA_VERIFICACAO, hojeStr)
      if (contas.length === 0) return

      const vencidas = contas.filter(c => new Date(c.data_vencimento + 'T00:00:00') < dataAtual)
      const totalAberto = contas.reduce((acc, c) => acc + Number(c.valor), 0)

      const titulo = vencidas.length > 0
        ? `⚠️ ${vencidas.length} conta${vencidas.length > 1 ? 's' : ''} vencida${vencidas.length > 1 ? 's' : ''}`
        : `📅 ${contas.length} conta${contas.length > 1 ? 's' : ''} vencendo em breve`
      const corpo = `Total em aberto: ${formatarMoeda(totalAberto)}`

      // Alerta dentro do app (sempre funciona, independe de permissão do navegador)
      toast?.warning(`${titulo} — ${corpo}`, 8000)

      // Notificação nativa do navegador (só se o usuário ligou "Notificações")
      const notificacoesAtivas = localStorage.getItem('pref_notif') !== 'false'
      if (notificacoesAtivas && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(titulo, { body: corpo, icon: '/logo.png' })
      }
    }

    verificar()
  }, [usuario, toast])
}
