import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, AlertTriangle, ChevronRight } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useRealtime } from '../hooks/useRealtime'
import { formatarDataHoraRelativa, conexaoPrecisaAtencao } from '../utils/importacoes'

// Só busca a conexão ativa (no máximo uma, hoje) e a contagem de pendentes —
// leve o bastante para ficar sempre no Dashboard sem pesar o carregamento.
// Exportada para o BottomNav/Sidebar reaproveitarem o mesmo cache do React Query
// (queryKey ['aviso-banco']) e mostrarem o badge de pendentes sem duplicar a consulta.
export async function carregarAvisoBanco() {
  const { data: conexao, error } = await supabase
    .from('conexoes_bancarias')
    .select('*')
    .eq('ativo', true)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!conexao) return null

  const { count, error: erroCount } = await supabase
    .from('importacoes_banco')
    .select('id', { count: 'exact', head: true })
    .eq('conexao_id', conexao.id)
    .eq('status', 'pendente')
  if (erroCount) throw erroCount

  return { conexao, pendentes: count || 0 }
}

/**
 * Aviso discreto no topo do Dashboard sobre a importação automática do Nubank.
 * Não renderiza nada quando não há conexão bancária ativa — a funcionalidade
 * continua totalmente opcional e o usuário pode seguir lançando tudo na mão.
 */
export default function AvisoBanco() {
  const queryClient = useQueryClient()

  useRealtime(['conexoes_bancarias', 'importacoes_banco'], () => {
    queryClient.invalidateQueries({ queryKey: ['aviso-banco'] })
  })

  const { data } = useQuery({
    queryKey: ['aviso-banco'],
    queryFn: carregarAvisoBanco,
    staleTime: 60 * 1000,
  })

  if (!data) return null
  const { conexao, pendentes } = data

  const precisaAtencao = conexaoPrecisaAtencao(conexao)
  const temPendentes = pendentes > 0

  const cores = precisaAtencao
    ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-200'
    : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-300'

  const conteudo = (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-xs sm:text-sm ${cores}`}>
      {precisaAtencao ? (
        <AlertTriangle size={16} className="shrink-0 text-amber-500 dark:text-amber-400" />
      ) : (
        <Landmark size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
      )}
      <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="font-bold">{conexao.nome || 'Nubank'}</span>
        <span className="opacity-50">·</span>
        <span>dados do banco {formatarDataHoraRelativa(conexao.dados_atualizados_em)}</span>
        <span className="opacity-50">·</span>
        <span>importado {formatarDataHoraRelativa(conexao.ultima_importacao_em)}</span>
        {precisaAtencao && conexao.ultimo_status === 'erro' && (
          <>
            <span className="opacity-50">·</span>
            <span className="font-semibold">falha na última importação</span>
          </>
        )}
        <span className="opacity-50">·</span>
        <span className="font-semibold">
          {temPendentes ? `${pendentes} a revisar` : 'tudo revisado'}
        </span>
      </div>
      {temPendentes && <ChevronRight size={16} className="shrink-0" />}
    </div>
  )

  if (!temPendentes) return conteudo

  return (
    <Link to="/importacoes" className="block hover:brightness-95 dark:hover:brightness-110 transition-[filter]">
      {conteudo}
    </Link>
  )
}
