import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabaseClient'
import { useRealtime } from '../hooks/useRealtime'
import { useToast } from '../components/Toast'
import CampoMoeda from '../components/CampoMoeda'
import { formatarMoeda, parseDataISO } from '../utils/helpers'
import { numeroParaMoeda } from '../utils/moeda'
import {
  formatarDataHoraRelativa,
  deveOferecerParcelamentoCompleto,
  ehParcelaDeCompraAnterior,
  formatarBadgeParcela,
  montarPayloadAprovacao,
  filtrarAprovaveisAutomaticamente,
  agruparImportacoesPorData,
  valoresPadraoFormulario,
} from '../utils/importacoes'
import {
  Landmark, Loader2, CheckCircle2, Check, X, EyeOff, Eye, RotateCcw, Link2,
  AlertTriangle, CreditCard, Wallet, ListChecks, Tag,
} from 'lucide-react'

// ─── Carregamento ─────────────────────────────────────────────────────────────

async function carregarDados() {
  const [
    { data: pendentes, error: e1 },
    { data: ignoradas, error: e2 },
    { data: categorias, error: e3 },
    { data: conexao },
  ] = await Promise.all([
    supabase.from('importacoes_banco').select('*')
      .eq('status', 'pendente')
      .order('data', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('importacoes_banco').select('*')
      .eq('status', 'ignorada')
      .order('revisada_em', { ascending: false })
      .limit(100), // as mais recentes bastam para restaurar algo ignorado por engano
    supabase.from('categorias').select('id, nome, tipo, icone, cor'),
    supabase.from('conexoes_bancarias').select('*').eq('ativo', true).limit(1).maybeSingle(),
  ])
  if (e1) throw e1
  if (e2) throw e2
  if (e3) throw e3

  // Busca os lançamentos manuais que o banco apontou como possíveis duplicados,
  // para mostrar descrição/valor/data de cada um junto do aviso.
  const idsDuplicadas = [...new Set(
    [...(pendentes || []), ...(ignoradas || [])]
      .map((i) => i.possivel_duplicada_id)
      .filter(Boolean)
  )]
  let duplicadasPorId = {}
  if (idsDuplicadas.length) {
    const { data: transacoesDup } = await supabase
      .from('transacoes')
      .select('id, descricao, valor, data_transacao')
      .in('id', idsDuplicadas)
    duplicadasPorId = Object.fromEntries((transacoesDup || []).map((t) => [t.id, t]))
  }

  return {
    pendentes: pendentes || [],
    ignoradas: ignoradas || [],
    categorias: categorias || [],
    conexao,
    duplicadasPorId,
  }
}

function formatarDataLabel(iso) {
  if (!iso || iso === 'Sem data') return 'Sem data'
  const d = parseDataISO(iso)
  const hj = new Date()
  const on = new Date(); on.setDate(on.getDate() - 1)
  if (d.toDateString() === hj.toDateString()) return 'Hoje'
  if (d.toDateString() === on.toDateString()) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

// ─── Cartão de um item pendente ────────────────────────────────────────────────

function CardPendente({ imp, form, categorias, duplicada, salvando, onChange, onAprovar, onIgnorar, onVincular }) {
  const ehCartao = imp.origem === 'cartao'
  const badgeParcela = formatarBadgeParcela(imp)
  const ofereceParcelamento = deveOferecerParcelamentoCompleto(imp)
  const parcelaAnterior = ehParcelaDeCompraAnterior(imp)

  const valorTotalCompra = imp.valor_total != null
    ? Number(imp.valor_total)
    : Number(imp.valor) * Number(imp.parcelas_total || 1)

  const opcoesTipo = imp.origem === 'conta'
    ? [{ v: 'despesa', l: 'Despesa' }, { v: 'receita', l: 'Receita' }, { v: 'pagamento_fatura', l: 'Pag. de fatura' }]
    : [{ v: 'despesa', l: 'Despesa' }, { v: 'receita', l: 'Receita' }]

  const ehPagamentoFatura = form.tipo === 'pagamento_fatura'

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Cabeçalho: origem, parcela, valor sugerido */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0
            ${ehCartao ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
            {ehCartao ? <CreditCard size={11} /> : <Wallet size={11} />}
            {ehCartao ? 'Cartão' : 'Conta'}
          </span>
          {badgeParcela && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 shrink-0">
              {badgeParcela}
            </span>
          )}
        </div>
        <p className="font-extrabold text-slate-800 dark:text-slate-100 text-sm shrink-0">
          {formatarMoeda(Number(imp.valor))}
        </p>
      </div>

      {/* Possível duplicada */}
      {imp.possivel_duplicada_id && (
        <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl px-3 py-2.5">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-200">Parece que você já lançou isto</p>
            {duplicada ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 truncate">
                {duplicada.descricao} · {formatarMoeda(Number(duplicada.valor))} · {duplicada.data_transacao ? parseDataISO(duplicada.data_transacao).toLocaleDateString('pt-BR') : ''}
              </p>
            ) : (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">Lançamento existente semelhante.</p>
            )}
            <button
              type="button"
              disabled={salvando}
              onClick={onVincular}
              className="mt-2 flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/50 px-3 py-1.5 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/80 transition-colors disabled:opacity-50"
            >
              <Link2 size={13} /> É o mesmo (vincular)
            </button>
          </div>
        </div>
      )}

      {/* Parcela de compra anterior */}
      {parcelaAnterior && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
          Parcela de uma compra anterior — lance só esta parcela ou ignore se ela já estiver no app.
        </p>
      )}

      {/* Descrição */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Descrição</label>
        <input
          type="text"
          value={form.descricao}
          onChange={(e) => onChange({ descricao: e.target.value })}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-base sm:text-sm"
        />
      </div>

      {/* Valor + Data */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Valor</label>
          <CampoMoeda
            value={typeof form.valor === 'number' ? numeroParaMoeda(form.valor) : form.valor}
            onChange={(valor) => onChange({ valor })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Data</label>
          <input
            type="date"
            value={form.data}
            onChange={(e) => onChange({ data: e.target.value })}
            className="w-full px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 text-base sm:text-sm"
          />
        </div>
      </div>

      {/* Tipo */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${opcoesTipo.length}, minmax(0, 1fr))` }}>
        {opcoesTipo.map((op) => (
          <button
            key={op.v}
            type="button"
            onClick={() => onChange({ tipo: op.v })}
            className={`py-2 rounded-xl font-semibold text-xs transition-all border
              ${form.tipo === op.v
                ? op.v === 'receita' ? 'bg-emerald-500 text-white border-emerald-500'
                  : op.v === 'pagamento_fatura' ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-red-500 text-white border-red-500'
                : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'}`}
          >
            {op.l}
          </button>
        ))}
      </div>

      {/* Categoria (some quando é pagamento de fatura) */}
      {ehPagamentoFatura ? (
        <p className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl px-3 py-2.5">
          Pagamento de fatura (não conta como gasto)
        </p>
      ) : (
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
          <div className="relative">
            <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select
              value={form.categoria_id}
              onChange={(e) => onChange({ categoria_id: e.target.value })}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 bg-white appearance-none text-base sm:text-sm"
            >
              <option value="">Selecione...</option>
              {categorias.filter((c) => c.tipo === form.tipo).map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Checkbox de parcelamento completo */}
      {ofereceParcelamento && (
        <label className="flex items-start gap-2.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(form.lancarParceladoCompleto)}
            onChange={(e) => onChange({ lancarParceladoCompleto: e.target.checked })}
            className="mt-0.5 w-4 h-4 accent-blue-600"
          />
          <span className="text-xs text-slate-600 dark:text-slate-300">
            Lançar a compra toda em {imp.parcelas_total} parcelas (total {formatarMoeda(valorTotalCompra)})
          </span>
        </label>
      )}

      {/* Ações */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={salvando}
          onClick={onIgnorar}
          className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <X size={15} /> Ignorar
        </button>
        <button
          type="button"
          disabled={salvando}
          onClick={onAprovar}
          className="flex-1 py-2.5 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Aprovar
        </button>
      </div>
    </div>
  )
}

// ─── Cartão de um item ignorado ─────────────────────────────────────────────────

function CardIgnorada({ imp, salvando, onRestaurar }) {
  const ehCartao = imp.origem === 'cartao'
  const badgeParcela = formatarBadgeParcela(imp)
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
        ${ehCartao ? 'bg-blue-50 text-blue-500 dark:bg-blue-950/40 dark:text-blue-300' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
        {ehCartao ? <CreditCard size={16} /> : <Wallet size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-700 dark:text-slate-200 text-sm truncate">{imp.descricao}</p>
        <p className="text-[11px] text-slate-400">
          {formatarMoeda(Number(imp.valor))}{badgeParcela ? ` · ${badgeParcela}` : ''}
        </p>
      </div>
      <button
        type="button"
        disabled={salvando}
        onClick={onRestaurar}
        className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors disabled:opacity-50"
      >
        <RotateCcw size={13} /> Restaurar
      </button>
    </div>
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function Importacoes() {
  const toast = useToast()
  const queryClient = useQueryClient()

  useRealtime(['importacoes_banco', 'conexoes_bancarias'], () => {
    queryClient.invalidateQueries({ queryKey: ['importacoes-banco'] })
  })

  const { data, isLoading } = useQuery({
    queryKey: ['importacoes-banco'],
    queryFn: carregarDados,
    staleTime: 30 * 1000,
  })

  const [verIgnoradas, setVerIgnoradas] = useState(false)
  const [formPorId, setFormPorId] = useState({})
  const [salvandoId, setSalvandoId] = useState(null)
  const [aprovandoTodas, setAprovandoTodas] = useState(false)
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 })

  const pendentes = data?.pendentes || []
  const ignoradas = data?.ignoradas || []
  const categorias = data?.categorias || []
  const conexao = data?.conexao
  const duplicadasPorId = data?.duplicadasPorId || {}

  // Semeia o form de cada pendente novo com os valores sugeridos pelo banco, sem
  // sobrescrever o que o usuário já estiver editando; limpa quem saiu da lista.
  useEffect(() => {
    setFormPorId((prev) => {
      let mudou = false
      const proximo = { ...prev }
      for (const imp of pendentes) {
        if (!proximo[imp.id]) {
          proximo[imp.id] = valoresPadraoFormulario(imp)
          mudou = true
        }
      }
      for (const id of Object.keys(proximo)) {
        if (!pendentes.some((imp) => imp.id === id)) {
          delete proximo[id]
          mudou = true
        }
      }
      return mudou ? proximo : prev
    })
  }, [pendentes])

  const grupos = useMemo(
    () => agruparImportacoesPorData(verIgnoradas ? ignoradas : pendentes),
    [pendentes, ignoradas, verIgnoradas]
  )

  const aprovaveisAutomaticamente = useMemo(
    () => filtrarAprovaveisAutomaticamente(pendentes, formPorId),
    [pendentes, formPorId]
  )

  const atualizarForm = (id, patch) => {
    setFormPorId((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  const invalidarTudo = () => {
    queryClient.invalidateQueries({ queryKey: ['importacoes-banco'] })
    queryClient.invalidateQueries({ queryKey: ['aviso-banco'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['transacoes'] })
  }

  const aprovar = async (imp) => {
    const form = formPorId[imp.id]
    if (!form) return
    if (!form.descricao?.trim() || !form.data) {
      toast.warning('Preencha descrição e data antes de aprovar.')
      return
    }
    if (form.tipo !== 'pagamento_fatura' && !form.categoria_id) {
      toast.warning('Escolha uma categoria antes de aprovar.')
      return
    }
    setSalvandoId(imp.id)
    try {
      const payload = montarPayloadAprovacao(imp, form)
      const { error } = await supabase.rpc('aprovar_importacao', payload)
      if (error) throw error
      toast.success('Lançamento aprovado!')
      invalidarTudo()
    } catch (err) {
      console.error('Erro ao aprovar importação:', err)
      toast.error(err?.message || 'Não foi possível aprovar. Tente novamente.')
    } finally {
      setSalvandoId(null)
    }
  }

  const ignorar = async (imp) => {
    setSalvandoId(imp.id)
    try {
      const { error } = await supabase
        .from('importacoes_banco')
        .update({ status: 'ignorada', revisada_em: new Date().toISOString() })
        .eq('id', imp.id)
      if (error) throw error
      toast.success('Importação ignorada.')
      invalidarTudo()
    } catch (err) {
      console.error('Erro ao ignorar importação:', err)
      toast.error('Não foi possível ignorar. Tente novamente.')
    } finally {
      setSalvandoId(null)
    }
  }

  const restaurar = async (imp) => {
    setSalvandoId(imp.id)
    try {
      const { error } = await supabase
        .from('importacoes_banco')
        .update({ status: 'pendente', revisada_em: null })
        .eq('id', imp.id)
      if (error) throw error
      toast.success('Importação restaurada para revisão.')
      invalidarTudo()
    } catch (err) {
      console.error('Erro ao restaurar importação:', err)
      toast.error('Não foi possível restaurar. Tente novamente.')
    } finally {
      setSalvandoId(null)
    }
  }

  const vincular = async (imp) => {
    setSalvandoId(imp.id)
    try {
      const { error } = await supabase
        .from('importacoes_banco')
        .update({
          status: 'aprovada',
          transacao_id: imp.possivel_duplicada_id,
          revisada_em: new Date().toISOString(),
        })
        .eq('id', imp.id)
      if (error) throw error
      toast.success('Vinculado ao lançamento existente.')
      invalidarTudo()
    } catch (err) {
      console.error('Erro ao vincular importação:', err)
      toast.error('Não foi possível vincular. Tente novamente.')
    } finally {
      setSalvandoId(null)
    }
  }

  const aprovarTodas = async () => {
    if (aprovaveisAutomaticamente.length === 0) return
    const total = aprovaveisAutomaticamente.length
    if (!window.confirm(`Aprovar ${total} lançamento${total > 1 ? 's' : ''} agora?`)) return

    setAprovandoTodas(true)
    setProgresso({ atual: 0, total })
    let falhas = 0
    for (let i = 0; i < aprovaveisAutomaticamente.length; i++) {
      const imp = aprovaveisAutomaticamente[i]
      const form = formPorId[imp.id]
      try {
        const payload = montarPayloadAprovacao(imp, form)
        const { error } = await supabase.rpc('aprovar_importacao', payload)
        if (error) throw error
      } catch (err) {
        console.error('Erro ao aprovar em lote:', imp.id, err)
        falhas++
      }
      setProgresso({ atual: i + 1, total })
    }
    setAprovandoTodas(false)
    invalidarTudo()
    if (falhas > 0) {
      toast.warning(`${total - falhas} aprovado${total - falhas === 1 ? '' : 's'}, ${falhas} falhou/falharam.`)
    } else {
      toast.success('Todos os lançamentos selecionados foram aprovados!')
    }
  }

  const listaVazia = verIgnoradas ? ignoradas.length === 0 : pendentes.length === 0

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto pb-28 space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-900 to-cyan-500 flex items-center justify-center">
          <Landmark size={17} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-extrabold text-slate-800 text-lg leading-tight dark:text-slate-100">Importações</h1>
          <p className="text-slate-400 text-xs">
            {conexao
              ? `${conexao.nome || 'Nubank'} · última importação ${formatarDataHoraRelativa(conexao.ultima_importacao_em)}`
              : 'Transações importadas do banco, aguardando revisão'}
          </p>
        </div>
      </div>

      {/* Barra de ações */}
      {!verIgnoradas && pendentes.length > 0 && (
        <div className="flex items-center justify-between gap-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl px-4 py-3 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {aprovaveisAutomaticamente.length > 0
              ? `${aprovaveisAutomaticamente.length} pronto${aprovaveisAutomaticamente.length > 1 ? 's' : ''} para aprovar em lote`
              : 'Escolha a categoria de cada item para aprovar em lote'}
          </div>
          <button
            type="button"
            disabled={aprovaveisAutomaticamente.length === 0 || aprovandoTodas}
            onClick={aprovarTodas}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-bold text-xs disabled:opacity-40"
          >
            {aprovandoTodas
              ? <><Loader2 size={13} className="animate-spin" /> {progresso.atual}/{progresso.total}</>
              : <><ListChecks size={13} /> Aprovar todas</>}
          </button>
        </div>
      )}

      {/* Alternador pendentes / ignoradas */}
      {(pendentes.length > 0 || ignoradas.length > 0) && (
        <button
          type="button"
          onClick={() => setVerIgnoradas((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          {verIgnoradas ? <Eye size={14} /> : <EyeOff size={14} />}
          {verIgnoradas ? 'Ver pendentes' : `Ver ignoradas${ignoradas.length ? ` (${ignoradas.length})` : ''}`}
        </button>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
      ) : listaVazia ? (
        <div className="py-16 text-center text-slate-400">
          {verIgnoradas ? (
            <>
              <EyeOff size={36} className="mx-auto mb-3 text-slate-200 dark:text-slate-700" />
              <p className="font-semibold text-slate-500 dark:text-slate-400">Nenhuma importação ignorada</p>
            </>
          ) : (
            <>
              <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-400" />
              <p className="font-bold text-slate-600 dark:text-slate-300 text-base">Nada para revisar 🎉</p>
              {conexao && (
                <p className="text-sm mt-1">Última importação: {formatarDataHoraRelativa(conexao.ultima_importacao_em)}</p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(({ data: dataGrupo, itens }) => (
            <div key={dataGrupo} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide capitalize">
                  {formatarDataLabel(dataGrupo)}
                </p>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-700">
                {itens.map((imp) => (
                  verIgnoradas ? (
                    <CardIgnorada
                      key={imp.id}
                      imp={imp}
                      salvando={salvandoId === imp.id}
                      onRestaurar={() => restaurar(imp)}
                    />
                  ) : (
                    formPorId[imp.id] && (
                      <CardPendente
                        key={imp.id}
                        imp={imp}
                        form={formPorId[imp.id]}
                        categorias={categorias}
                        duplicada={imp.possivel_duplicada_id ? duplicadasPorId[imp.possivel_duplicada_id] : null}
                        salvando={salvandoId === imp.id || aprovandoTodas}
                        onChange={(patch) => atualizarForm(imp.id, patch)}
                        onAprovar={() => aprovar(imp)}
                        onIgnorar={() => ignorar(imp)}
                        onVincular={() => vincular(imp)}
                      />
                    )
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
