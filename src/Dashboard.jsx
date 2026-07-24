import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabaseClient'
import { formatarMoeda } from './utils/helpers'
import { corTema } from './utils/tema'
import { useToast } from './components/Toast'
import {
  TrendingUp, TrendingDown, CreditCard, Clock, ChevronRight,
  ArrowUpRight, ArrowDownRight, Wallet, Repeat, Receipt,
  CheckCircle2, Loader2, AlertCircle, LayoutDashboard
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

// ─── Query principal ──────────────────────────────────────────────────────────

async function carregarDados() {
  const hoje = new Date()
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
  const ultimoDia   = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59).toISOString()
  const primeiroDiaMesAnt = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString()
  const ultimoDiaMesAnt   = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59).toISOString()

  const [
    { data: transacoes },
    { data: transacoesMesAnt },
    { data: cartoes },
    { data: todasContas },   // pagas E pendentes — para calcular total real da dívida
  ] = await Promise.all([
    supabase.from('transacoes').select('*, categorias(nome, cor)')
      .gte('data_transacao', primeiroDia).lte('data_transacao', ultimoDia)
      .order('data_transacao', { ascending: false }),
    supabase.from('transacoes').select('tipo, valor')
      .gte('data_transacao', primeiroDiaMesAnt).lte('data_transacao', ultimoDiaMesAnt),
    supabase.from('cartoes').select('fatura_atual, nome'),
    supabase.from('contas')
      .select('*, categorias(nome, icone, cor)')
      .order('data_vencimento', { ascending: true }),
  ])

  // ── Totais do mês ──────────────────────────────────────────────────────────
  let receitasMes = 0, despesasMes = 0, receitasMesAnt = 0, despesasMesAnt = 0
  transacoes?.forEach(t => {
    const v = Number(t.valor)
    if (t.tipo === 'receita') receitasMes += v
    else despesasMes += v
  })
  transacoesMesAnt?.forEach(t => {
    const v = Number(t.valor)
    if (t.tipo === 'receita') receitasMesAnt += v
    else despesasMesAnt += v
  })
  const saldo = receitasMes - despesasMes
  const totalFaturas = cartoes?.reduce((acc, c) => acc + Number(c.fatura_atual), 0) || 0

  // ── Alertas: separando Vencidas e Vencem em Breve (2 dias) ────────
  const dataAtual = new Date()
  dataAtual.setHours(0, 0, 0, 0) // Zera as horas para comparar apenas as datas

  const limiteEmBreve = new Date(dataAtual)
  limiteEmBreve.setDate(dataAtual.getDate() + 2) // Limite de 2 dias no futuro

  const contasVencidas = []
  const contasEmBreve = []

  ;(todasContas || []).forEach(c => {
    if (c.status_pago || !c.data_vencimento) return
    const dataVenc = new Date(c.data_vencimento + 'T00:00:00')

    if (dataVenc < dataAtual) {
      contasVencidas.push(c)
    } else if (dataVenc >= dataAtual && dataVenc <= limiteEmBreve) {
      contasEmBreve.push(c)
    }
  })

  // ── Compromissos: agrupa por id_parcelamento (inclui pagas para saber quanto já foi pago) ──
  const mapaParcelamentos = {}
  const contasAvulsasPendentes = []

  ;(todasContas || []).forEach(c => {
    const valor = Number(c.valor)

    if (c.id_parcelamento && c.total_parcelas > 1) {
      if (!mapaParcelamentos[c.id_parcelamento]) {
        mapaParcelamentos[c.id_parcelamento] = {
          id: c.id_parcelamento,
          descricao: c.descricao,
          valorParcela: valor,
          total_parcelas: c.total_parcelas,
          valorTotal: valor * c.total_parcelas,
          valorPago: 0,
          parcelasPagas: 0,
          valorRestante: 0,
          parcelas_restantes: 0,
          proximaParcela: null,
          categoria: c.categorias,
          tipo: 'parcelamento',
        }
      }
      const p = mapaParcelamentos[c.id_parcelamento]
      if (c.status_pago) {
        p.valorPago += valor
        p.parcelasPagas += 1
      } else {
        p.valorRestante += valor
        p.parcelas_restantes += 1
        if (!p.proximaParcela) p.proximaParcela = c.data_vencimento
      }
    } else if (!c.status_pago) {
      contasAvulsasPendentes.push({
        id: c.id,
        descricao: c.descricao,
        valorTotal: valor,
        valorPago: 0,
        valorRestante: valor,
        total_parcelas: 1,
        parcelasPagas: 0,
        parcelas_restantes: 1,
        proximaParcela: c.data_vencimento,
        categoria: c.categorias,
        tipo: 'avulsa',
      })
    }
  })

  const parcelamentos = Object.values(mapaParcelamentos).filter(p => p.parcelas_restantes > 0)

  const compromissos = [
    ...parcelamentos,
    ...contasAvulsasPendentes,
  ].sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'parcelamento' ? -1 : 1
    if (!a.proximaParcela) return 1
    if (!b.proximaParcela) return -1
    return new Date(a.proximaParcela) - new Date(b.proximaParcela)
  })

  const totalDividas = compromissos.reduce((acc, c) => acc + c.valorRestante, 0)

  // ── Últimas movimentações ──────────────────────────────────────────────────
  const movimentacoes = (transacoes || []).slice(0, 5)

  // ── Gráfico últimos 6 meses ────────────────────────────────────────────────
  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const grafico = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1)
    return { mes: mesesNomes[d.getMonth()], receitas: 0, despesas: 0, _ano: d.getFullYear(), _mes: d.getMonth() }
  })
  transacoes?.forEach(t => {
    const d = new Date(t.data_transacao + 'T12:00:00')
    const idx = grafico.findIndex(g => g._ano === d.getFullYear() && g._mes === d.getMonth())
    if (idx !== -1) {
      if (t.tipo === 'receita') grafico[idx].receitas += Number(t.valor)
      else grafico[idx].despesas += Number(t.valor)
    }
  })

  return {
    saldo, receitasMes, despesasMes, receitasMesAnt, despesasMesAnt,
    totalFaturas, contasVencidas, contasEmBreve, compromissos, totalDividas,
    movimentacoes, grafico
  }
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function BadgeVariacao({ atual, anterior, inverso = false }) {
  if (anterior === 0) return null
  const pct = ((atual - anterior) / anterior) * 100
  const positivo = inverso ? pct <= 0 : pct >= 0
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 w-fit
      ${positivo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
      {pct >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

function BarraDupla({ pctPago, cor }) {
  return (
    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex dark:bg-slate-700">
      <div
        className="h-full rounded-l-full transition-all duration-700"
        style={{ width: `${Math.min(pctPago, 100)}%`, backgroundColor: cor }}
      />
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Dashboard() {
  const toast = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: carregarDados,
    staleTime: 2 * 60 * 1000,
    onError: () => toast.error('Erro ao carregar o dashboard.'),
  })

  if (isLoading) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
      </div>
    )
  }

  if (!data) return null

  const {
    saldo, receitasMes, despesasMes, receitasMesAnt, despesasMesAnt,
    totalFaturas, contasVencidas, contasEmBreve, compromissos, totalDividas,
    movimentacoes, grafico
  } = data

  const temGrafico = grafico.some(g => g.receitas > 0 || g.despesas > 0)
  const alertasAtivos = localStorage.getItem('pref_alerta') !== 'false'

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto pb-28 space-y-5">

      {/* ── Cabeçalho ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-900 to-cyan-500 flex items-center justify-center">
          <LayoutDashboard size={18} className="text-white" />
        </div>
        <div>
          <h1 className="font-extrabold text-slate-800 text-lg leading-tight dark:text-slate-100">Dashboard</h1>
          <p className="text-slate-400 text-xs">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
      </div>

      {/* ── Banners de alerta com listagem visual ───────────────────────────── */}
      <div className="flex flex-col gap-4">
        
        {/* Banner Vencidas (Vermelho) — só aparece se "Alertas de Vencimento" estiver ativo em Configurações */}
        {alertasAtivos && contasVencidas.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <AlertCircle size={17} className="text-red-600" />
                </div>
                <div>
                  <p className="text-red-900 font-bold text-sm">
                    {contasVencidas.length} conta{contasVencidas.length > 1 ? 's' : ''} vencida{contasVencidas.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-red-600 text-xs">
                    {formatarMoeda(contasVencidas.reduce((a, c) => a + Number(c.valor), 0))} em aberto
                  </p>
                </div>
              </div>
              <Link to="/contas"
                className="shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors">
                Pagar agora
              </Link>
            </div>
            
            {/* Listagem Vencidas */}
            <div className="px-5 pb-4 pt-3 border-t border-red-200/60 bg-red-50/50">
              <div className="space-y-2.5">
                {contasVencidas.slice(0, 3).map(conta => (
                  <div key={conta.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      <span className="font-semibold text-red-900 truncate">{conta.descricao}</span>
                      <span className="text-[11px] text-red-500 shrink-0 hidden sm:inline">
                        (venceu dia {new Date(conta.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })})
                      </span>
                    </div>
                    <span className="font-bold text-red-700 shrink-0 pl-2">
                      {formatarMoeda(Number(conta.valor))}
                    </span>
                  </div>
                ))}
                {contasVencidas.length > 3 && (
                  <Link to="/contas" className="text-xs text-red-500 hover:text-red-700 font-medium pt-1 block w-fit">
                    + {contasVencidas.length - 3} outra{contasVencidas.length - 3 > 1 ? 's' : ''} conta{contasVencidas.length - 3 > 1 ? 's' : ''} vencida{contasVencidas.length - 3 > 1 ? 's' : ''}...
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Banner Vencem em breve (Amarelo) — mesma regra de "Alertas de Vencimento" */}
        {alertasAtivos && contasEmBreve.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Clock size={17} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-amber-900 font-bold text-sm">
                    {contasEmBreve.length} conta{contasEmBreve.length > 1 ? 's' : ''} vencem em breve
                  </p>
                  <p className="text-amber-600 text-xs">
                    {formatarMoeda(contasEmBreve.reduce((a, c) => a + Number(c.valor), 0))} em aberto
                  </p>
                </div>
              </div>
              <Link to="/contas"
                className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-colors">
                Ver agora
              </Link>
            </div>

            {/* Listagem Em breve */}
            <div className="px-5 pb-4 pt-3 border-t border-amber-200/60 bg-amber-50/50">
              <div className="space-y-2.5">
                {contasEmBreve.slice(0, 3).map(conta => (
                  <div key={conta.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                      <span className="font-semibold text-amber-900 truncate">{conta.descricao}</span>
                      <span className="text-[11px] text-amber-600 shrink-0 hidden sm:inline">
                        (vence dia {new Date(conta.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })})
                      </span>
                    </div>
                    <span className="font-bold text-amber-700 shrink-0 pl-2">
                      {formatarMoeda(Number(conta.valor))}
                    </span>
                  </div>
                ))}
                {contasEmBreve.length > 3 && (
                  <Link to="/contas" className="text-xs text-amber-600 hover:text-amber-800 font-medium pt-1 block w-fit">
                    + {contasEmBreve.length - 3} outra{contasEmBreve.length - 3 > 1 ? 's' : ''} conta{contasEmBreve.length - 3 > 1 ? 's' : ''}...
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Card de saldo ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl mt-2">
        <div className="absolute -top-12 -right-12 w-52 h-52 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/5 rounded-full pointer-events-none" />
        <div className="relative z-10">
          <p className="text-blue-200 text-sm font-medium mb-1">Saldo do mês</p>
          <p className={`text-4xl md:text-5xl font-extrabold tracking-tight mb-6 ${saldo >= 0 ? 'text-white' : 'text-red-300'}`}>
            {formatarMoeda(saldo)}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Receitas',  valor: receitasMes,  ant: receitasMesAnt,  icon: <TrendingUp  size={13}/>, cor: 'text-emerald-300', inv: false },
              { label: 'Despesas',  valor: despesasMes,  ant: despesasMesAnt,  icon: <TrendingDown size={13}/>, cor: 'text-red-300',     inv: true  },
              { label: 'Faturas',   valor: totalFaturas, ant: 0,               icon: <CreditCard  size={13}/>, cor: 'text-blue-200',   inv: true  },
            ].map(({ label, valor, ant, icon, cor, inv }) => (
              <div key={label} className="bg-white/10 backdrop-blur-sm rounded-2xl p-3">
                <p className={`text-[11px] font-semibold flex items-center gap-1 mb-1 ${cor}`}>{icon}{label}</p>
                <p className="text-white font-bold text-sm">{formatarMoeda(valor)}</p>
                <BadgeVariacao atual={valor} anterior={ant} inverso={inv} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CARD PRINCIPAL: Compromissos Financeiros ───────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">

        <div className="px-6 py-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-extrabold text-slate-800 text-base dark:text-slate-100">Compromissos Financeiros</h2>
              <p className="text-slate-400 text-xs mt-0.5">
                {compromissos.length > 0
                  ? `${compromissos.filter(c => c.tipo === 'parcelamento').length} parcelamento${compromissos.filter(c => c.tipo === 'parcelamento').length !== 1 ? 's' : ''} · ${compromissos.filter(c => c.tipo === 'avulsa').length} conta${compromissos.filter(c => c.tipo === 'avulsa').length !== 1 ? 's' : ''} avulsa${compromissos.filter(c => c.tipo === 'avulsa').length !== 1 ? 's' : ''}`
                  : 'Nenhum compromisso pendente'}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">Total em aberto</p>
              <p className="text-2xl font-extrabold text-red-600 leading-tight">{formatarMoeda(totalDividas)}</p>
            </div>
          </div>
        </div>

        {compromissos.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-slate-400">
            <CheckCircle2 size={40} className="text-emerald-400" />
            <p className="font-bold text-slate-600 text-base dark:text-slate-300">Tudo em dia!</p>
            <p className="text-sm">Nenhum compromisso pendente no momento.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-700">
            {compromissos.map((c, idx) => {
              const pctPago = c.valorTotal > 0 ? (c.valorPago / c.valorTotal) * 100 : 0
              const pctDoTotal = totalDividas > 0 ? (c.valorRestante / totalDividas) * 100 : 0
              const cor = c.categoria?.cor || (c.tipo === 'parcelamento' ? '#3b82f6' : '#64748b')
              
              let isVencida = false
              let isVencendoEmBreve = false

              if (c.proximaParcela) {
                const hojeBadge = new Date()
                hojeBadge.setHours(0, 0, 0, 0)
                
                const limiteBadge = new Date(hojeBadge)
                limiteBadge.setDate(hojeBadge.getDate() + 2)
                
                const dataVencParcela = new Date(c.proximaParcela + 'T00:00:00')

                if (dataVencParcela < hojeBadge) {
                  isVencida = true
                } else if (dataVencParcela >= hojeBadge && dataVencParcela <= limiteBadge) {
                  isVencendoEmBreve = true
                }
              }

              return (
                <div key={c.id || idx} className="px-6 py-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: cor + '18', color: cor }}>
                        {c.tipo === 'parcelamento' ? <Repeat size={17} /> : <Receipt size={17} />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-800 text-sm truncate dark:text-slate-100">{c.descricao}</p>
                          
                          {isVencida && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                              <AlertCircle size={10} /> Vencida
                            </span>
                          )}
                          {isVencendoEmBreve && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                              <Clock size={10} /> Vence em breve
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {c.tipo === 'parcelamento' && (
                            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full dark:bg-slate-800">
                              Parcela {c.parcelasPagas + 1}/{c.total_parcelas}
                            </span>
                          )}
                          {c.categoria?.nome && (
                            <span className="text-[11px] text-slate-400">{c.categoria.nome}</span>
                          )}
                          {c.proximaParcela && (
                            <span className="text-[11px] text-slate-400">
                              Vence {new Date(c.proximaParcela + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base font-extrabold text-slate-800 dark:text-slate-100">{formatarMoeda(c.valorRestante)}</p>
                      <p className="text-[11px] text-slate-400">restante</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap mb-3 dark:text-slate-400">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{formatarMoeda(c.valorTotal)} total</span>
                    <span className="text-slate-300">·</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block bg-emerald-400" />
                      Pago {formatarMoeda(c.valorPago)}
                      {c.tipo === 'parcelamento' && ` (${c.parcelasPagas}/${c.total_parcelas})`}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full inline-block bg-red-400" />
                      Restante {formatarMoeda(c.valorRestante)}
                      {c.tipo === 'parcelamento' && ` (${c.parcelas_restantes}x de ${formatarMoeda(c.valorParcela)})`}
                    </span>
                  </div>

                  {c.tipo === 'parcelamento' && (
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                        <span>{pctPago.toFixed(0)}% pago</span>
                        <span>{(100 - pctPago).toFixed(0)}% restante</span>
                      </div>
                      <BarraDupla pctPago={pctPago} cor={cor} />
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden dark:bg-slate-700">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pctDoTotal}%`, backgroundColor: cor + 'aa' }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 w-14 text-right font-medium">
                      {pctDoTotal.toFixed(1)}% do total
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {compromissos.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/40 dark:border-slate-700">
            <Link to="/contas"
              className="flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors">
              Gerenciar todas as contas <ChevronRight size={16} />
            </Link>
          </div>
        )}
      </div>

      {/* ── Gráfico + Movimentações ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700">
          <h2 className="font-bold text-slate-800 text-sm mb-0.5 dark:text-slate-100">Fluxo dos Últimos 6 Meses</h2>
          <p className="text-slate-400 text-xs mb-5">Receitas vs. despesas mês a mês</p>
          {temGrafico ? (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={grafico} barSize={9} barGap={2}>
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: corTema('#94a3b8', '#64748b') }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    formatter={(v, name) => [formatarMoeda(v), name === 'receitas' ? 'Receitas' : 'Despesas']}
                    contentStyle={{
                      borderRadius: 12,
                      border: `1px solid ${corTema('#e2e8f0', '#334155')}`,
                      backgroundColor: corTema('#ffffff', '#1e293b'),
                      color: corTema('#1e293b', '#f1f5f9'),
                      fontSize: 11
                    }}
                    cursor={{ fill: corTema('#f8fafc', '#334155') }}
                  />
                  <Bar dataKey="receitas" fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="despesas" fill="#f87171" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-5 mt-2">
                <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Receitas
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Despesas
                </span>
              </div>
            </>
          ) : (
            <div className="h-[190px] flex flex-col items-center justify-center gap-2 text-slate-400">
              <Wallet size={28} className="text-slate-300" />
              <p className="text-sm">Nenhuma movimentação registrada.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-slate-800 text-sm mb-0.5 dark:text-slate-100">Movimentações Recentes</h2>
              <p className="text-slate-400 text-xs">Últimas transações do mês</p>
            </div>
            <Link to="/transacoes"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
              Ver todas <ChevronRight size={14} />
            </Link>
          </div>

          {movimentacoes.length === 0 ? (
            <div className="h-[190px] flex flex-col items-center justify-center gap-2 text-slate-400">
              <Wallet size={28} className="text-slate-300" />
              <p className="text-sm">Nenhuma movimentação neste mês.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {movimentacoes.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-slate-50 transition-colors dark:hover:bg-slate-700">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                    ${t.tipo === 'receita' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                    {t.tipo === 'receita' ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate dark:text-slate-100">{t.descricao}</p>
                    <p className="text-[11px] text-slate-400">
                      {new Date(t.data_transacao + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      {t.categorias?.nome ? ` · ${t.categorias.nome}` : ''}
                    </p>
                  </div>
                  <p className={`text-sm font-bold shrink-0 ${t.tipo === 'receita' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {t.tipo === 'receita' ? '+' : '-'}{formatarMoeda(t.valor)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Faturas abertas ───────────────────────────────────────────────── */}
      {totalFaturas > 0 && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-800 text-sm mb-0.5 dark:text-slate-100">Faturas Abertas</h2>
              <p className="text-slate-400 text-xs">Gastos acumulados nos cartões</p>
            </div>
            <Link to="/cartoes"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors">
              Gerenciar <ChevronRight size={14} />
            </Link>
          </div>
          <div className="flex items-center gap-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100 rounded-2xl px-5 py-4 dark:border-slate-700">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <CreditCard size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-blue-600 font-semibold">Total em faturas abertas</p>
              <p className="text-2xl font-extrabold text-blue-900">{formatarMoeda(totalFaturas)}</p>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}