import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { formatarMoeda } from '../utils/helpers'
import { useToast } from '../components/Toast'
import {
  ArrowRightLeft, TrendingUp, TrendingDown, Trash2,
  Loader2, ChevronLeft, ChevronRight, Search, X, Pencil, Tag
} from 'lucide-react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function Transacoes() {
  const toast = useToast()
  const hoje = new Date()

  const [transacoes, setTransacoes]     = useState([])
  const [categorias, setCategorias]     = useState([])
  const [loading, setLoading]           = useState(true)
  const [busca, setBusca]               = useState('')
  const [mesAtual, setMesAtual]         = useState(hoje.getMonth())
  const [anoAtual, setAnoAtual]         = useState(hoje.getFullYear())
  const [salvando, setSalvando]         = useState(false)
  const [modalEditar, setModalEditar]   = useState({ show: false, transacao: null })
  const [editando, setEditando]         = useState({ descricao: '', valor: '', data_transacao: '', categoria_id: '', tipo: '' })

  const aplicarMascara = (v) => {
    const n = v.replace(/\D/g, '')
    if (!n) return ''
    return (parseInt(n, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  const converterFloat = (v) => parseFloat(v.toString().replace(/\./g, '').replace(',', '.'))

  const carregarDados = async () => {
    setLoading(true)
    try {
      const primeiroDia = new Date(anoAtual, mesAtual, 1).toISOString().split('T')[0]
      const ultimoDia   = new Date(anoAtual, mesAtual + 1, 0).toISOString().split('T')[0]

      const { data } = await supabase
        .from('transacoes')
        .select('*, categorias(nome, cor)')
        .gte('data_transacao', primeiroDia)
        .lte('data_transacao', ultimoDia)
        .order('data_transacao', { ascending: false })

      setTransacoes(data || [])

      const { data: cats } = await supabase.from('categorias').select('id, nome, tipo')
      setCategorias(cats || [])
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar transações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarDados() }, [mesAtual, anoAtual])

  const alterarMes = (dir) => {
    let m = mesAtual + dir, a = anoAtual
    if (m > 11) { m = 0; a++ }
    if (m < 0)  { m = 11; a-- }
    setMesAtual(m); setAnoAtual(a)
  }

  const abrirEditar = (t) => {
    setEditando({
      descricao: t.descricao,
      valor: aplicarMascara(String(Math.round(Number(t.valor) * 100))),
      data_transacao: t.data_transacao || '',
      categoria_id: t.categoria_id || '',
      tipo: t.tipo
    })
    setModalEditar({ show: true, transacao: t })
  }

  const salvarEdicao = async (e) => {
    e.preventDefault()
    setSalvando(true)
    try {
      const valor = converterFloat(editando.valor)
      if (!valor || !editando.data_transacao) {
        toast.warning('Preencha todos os campos obrigatórios.')
        setSalvando(false)
        return
      }
      const { error } = await supabase.from('transacoes').update({
        descricao: editando.descricao,
        valor,
        data_transacao: editando.data_transacao,
        categoria_id: editando.categoria_id || null,
        tipo: editando.tipo
      }).eq('id', modalEditar.transacao.id)
      if (error) throw error
      toast.success('Transação atualizada!')
      setModalEditar({ show: false, transacao: null })
      carregarDados()
    } catch (err) {
      toast.error('Erro ao salvar. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const excluir = async (t) => {
    if (!window.confirm(`Excluir "${t.descricao}"?`)) return
    try {
      const { error } = await supabase.from('transacoes').delete().eq('id', t.id)
      if (error) throw error
      toast.success('Transação excluída.')
      carregarDados()
    } catch (err) {
      toast.error('Erro ao excluir.')
    }
  }

  // Totais do mês
  const totalReceitas  = transacoes.filter(t => t.tipo === 'receita').reduce((a, t) => a + Number(t.valor), 0)
  const totalDespesas  = transacoes.filter(t => t.tipo === 'despesa').reduce((a, t) => a + Number(t.valor), 0)
  const saldo          = totalReceitas - totalDespesas

  // Filtro de busca
  const filtradas = transacoes.filter(t =>
    t.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
    t.categorias?.nome?.toLowerCase().includes(busca.toLowerCase())
  )

  // Agrupadas por data
  const agrupadas = filtradas.reduce((acc, t) => {
    const d = t.data_transacao || 'Sem data'
    if (!acc[d]) acc[d] = []
    acc[d].push(t)
    return acc
  }, {})
  const datasOrdenadas = Object.keys(agrupadas).sort((a, b) => b.localeCompare(a))

  const formatarDataLabel = (iso) => {
    if (iso === 'Sem data') return iso
    const d = new Date(iso + 'T12:00:00')
    const hj = new Date()
    const on = new Date(); on.setDate(on.getDate() - 1)
    if (d.toDateString() === hj.toDateString()) return 'Hoje'
    if (d.toDateString() === on.toDateString()) return 'Ontem'
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-28 space-y-5">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-900 to-cyan-500 flex items-center justify-center">
          <ArrowRightLeft size={17} className="text-white" />
        </div>
        <div>
          <h1 className="font-extrabold text-slate-800 text-lg leading-tight dark:text-slate-100">Transações</h1>
          <p className="text-slate-400 text-xs">Histórico de receitas e despesas</p>
        </div>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between bg-white px-5 py-3.5 rounded-2xl border border-slate-100 shadow-sm dark:bg-slate-800 dark:border-slate-700">
        <button onClick={() => alterarMes(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 dark:text-slate-400">
          <ChevronLeft size={20} />
        </button>
        <span className="font-bold text-slate-800 dark:text-slate-100">{MESES[mesAtual]} {anoAtual}</span>
        <button onClick={() => alterarMes(1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 dark:text-slate-400">
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Receitas',  valor: totalReceitas, cor: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: <TrendingUp size={16} className="text-emerald-500" /> },
          { label: 'Despesas',  valor: totalDespesas, cor: 'text-red-600',     bg: 'bg-red-50 border-red-100',         icon: <TrendingDown size={16} className="text-red-500" /> },
          { label: 'Saldo',     valor: saldo,         cor: saldo >= 0 ? 'text-blue-700' : 'text-red-600', bg: 'bg-blue-50 border-blue-100', icon: <ArrowRightLeft size={16} className="text-blue-500" /> },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border rounded-2xl p-4`}>
            <div className="flex items-center gap-1.5 mb-1">{c.icon}<span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{c.label}</span></div>
            <p className={`font-extrabold text-sm ${c.cor}`}>{formatarMoeda(c.valor)}</p>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" placeholder="Buscar transações..."
          value={busca} onChange={e => setBusca(e.target.value)}
          className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-sm dark:border-slate-700"
        />
        {busca && (
          <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>
      ) : filtradas.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <ArrowRightLeft size={36} className="mx-auto mb-3 text-slate-200" />
          <p className="font-semibold text-slate-500 dark:text-slate-400">Nenhuma transação encontrada</p>
          <p className="text-sm mt-1">{busca ? 'Tente outro termo de busca.' : `Nenhuma movimentação em ${MESES[mesAtual]}.`}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {datasOrdenadas.map(data => (
            <div key={data} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 dark:bg-slate-800 dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide capitalize dark:text-slate-400">
                  {formatarDataLabel(data)}
                </p>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-700">
                {agrupadas[data].map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50/50 transition-colors group">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                      ${t.tipo === 'receita' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                      {t.tipo === 'receita' ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm truncate dark:text-slate-100">{t.descricao}</p>
                      {t.categorias?.nome && (
                        <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: t.categorias.cor || '#94a3b8' }} />
                          {t.categorias.nome}
                        </span>
                      )}
                    </div>
                    <p className={`font-bold text-sm shrink-0 ${t.tipo === 'receita' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
                      {t.tipo === 'receita' ? '+' : '-'}{formatarMoeda(t.valor)}
                    </p>
                    <div className="flex items-center gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button onClick={() => abrirEditar(t)}
                        className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors dark:hover:bg-slate-700">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => excluir(t)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Edição */}
      {modalEditar.show && modalEditar.transacao && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden dark:bg-slate-800">
            <div className="bg-gradient-to-r from-blue-900 to-cyan-500 px-6 py-4 flex items-center justify-between text-white">
              <h2 className="font-bold text-lg flex items-center gap-2"><Pencil size={18} /> Editar Transação</h2>
              <button onClick={() => setModalEditar({ show: false, transacao: null })} className="p-2 hover:bg-white/20 rounded-full">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={salvarEdicao} className="p-6 space-y-4">
              {/* Tipo */}
              <div className="grid grid-cols-2 gap-2">
                {['despesa','receita'].map(tipo => (
                  <button key={tipo} type="button"
                    onClick={() => setEditando({...editando, tipo})}
                    className={`py-2.5 rounded-xl font-semibold text-sm transition-all border
                      ${editando.tipo === tipo
                        ? tipo === 'receita' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-red-500 text-white border-red-500'
                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}>
                    {tipo === 'receita' ? '↑ Receita' : '↓ Despesa'}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Descrição</label>
                <input type="text" required value={editando.descricao}
                  onChange={e => setEditando({...editando, descricao: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Valor (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
                    <input type="text" required value={editando.valor}
                      onChange={e => setEditando({...editando, valor: aplicarMascara(e.target.value)})}
                      className="w-full pl-10 pr-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold dark:border-slate-700"
                      placeholder="0,00" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Data</label>
                  <input type="date" required value={editando.data_transacao}
                    onChange={e => setEditando({...editando, data_transacao: e.target.value})}
                    className="w-full px-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm dark:border-slate-700" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Categoria</label>
                <div className="relative">
                  <Tag size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select value={editando.categoria_id}
                    onChange={e => setEditando({...editando, categoria_id: e.target.value})}
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 bg-white appearance-none text-sm dark:border-slate-700 dark:bg-slate-800">
                    <option value="">Sem categoria</option>
                    {categorias.filter(c => c.tipo === editando.tipo).map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModalEditar({ show: false, transacao: null })}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors dark:text-slate-200 dark:bg-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-bold flex justify-center items-center gap-2">
                  {salvando ? <Loader2 size={18} className="animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
