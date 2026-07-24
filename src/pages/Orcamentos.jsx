import { useState, useEffect } from 'react'
import { PieChart, Plus, Trash2, AlertTriangle, Loader2, Target, CheckCircle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { formatarMoeda } from '../utils/helpers'
import { useToast } from '../components/Toast'

export default function Orcamentos() {
  const toast = useToast()
  const [orcamentos, setOrcamentos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Estados do Modal
  const [showModal, setShowModal] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [novaCategoriaId, setNovaCategoriaId] = useState('')
  const [novoLimite, setNovoLimite] = useState('')

  const carregarDados = async () => {
    setLoading(true)
    try {
      const dataAtual = new Date()
      const mesAtual = dataAtual.getMonth() + 1
      const anoAtual = dataAtual.getFullYear()

      // 1. Buscar Orçamentos do mês atual
      const { data: orcamentosDB } = await supabase
        .from('orcamentos')
        .select('*, categorias(id, nome, icone, cor)')
        .eq('mes', mesAtual)
        .eq('ano', anoAtual)

      // 2. Buscar Categorias para o formulário (apenas despesas)
      const { data: categoriasDB } = await supabase
        .from('categorias')
        .select('*')
        .eq('tipo', 'despesa')
        .order('nome')

      // 3. Buscar Transações do mês atual para calcular o gasto
      const primeiroDia = new Date(anoAtual, mesAtual - 1, 1).toISOString().split('T')[0]
      const ultimoDia = new Date(anoAtual, mesAtual, 0).toISOString().split('T')[0]

      const { data: transacoes } = await supabase
        .from('transacoes')
        .select('valor, categoria_id')
        .eq('tipo', 'despesa')
        .gte('data_transacao', primeiroDia)
        .lte('data_transacao', ultimoDia)

      // Soma os gastos por categoria
      const gastosPorCategoria = {}
      transacoes?.forEach(t => {
        if (t.categoria_id) {
          gastosPorCategoria[t.categoria_id] = (gastosPorCategoria[t.categoria_id] || 0) + Number(t.valor)
        }
      })

      // Junta o limite do orçamento com o que já foi gasto de verdade
      const orcamentosCalculados = orcamentosDB?.map(o => {
        const gastoReal = gastosPorCategoria[o.categoria_id] || 0
        return {
          ...o,
          valor_gasto_real: gastoReal
        }
      }) || []

      setCategorias(categoriasDB || [])
      setOrcamentos(orcamentosCalculados)
    } catch (error) {
      console.error("Erro ao carregar orçamentos:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarDados()
  }, [])

  const handleSalvar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    try {
      const dataAtual = new Date()
      
      const { error } = await supabase.from('orcamentos').insert([{
        categoria_id: novaCategoriaId,
        limite_mensal: parseFloat(novoLimite.replace(',', '.')), // <-- CORRIGIDO AQUI!
        mes: dataAtual.getMonth() + 1,
        ano: dataAtual.getFullYear()
      }])

      if (error) {
        if (error.code === '23505') { 
          toast.warning('Você já tem um orçamento para esta categoria neste mês.')
        } else {
          throw error
        }
      } else {
        setShowModal(false)
        setNovaCategoriaId('')
        setNovoLimite('')
        carregarDados()
      }
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error)
      toast.error('Erro ao salvar o orçamento. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async (id) => {
    if (!window.confirm('Deseja excluir este orçamento?')) return
    try {
      await supabase.from('orcamentos').delete().eq('id', id)
      carregarDados()
    } catch (error) {
      toast.error('Erro ao excluir orçamento. Tente novamente.')
    }
  }


  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in pb-24">
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3 dark:text-slate-100">
            <PieChart className="text-blue-600" size={32} />
            Orçamentos do Mês
          </h1>
          <p className="text-slate-500 mt-2 dark:text-slate-400">Defina limites e acompanhe seus gastos por categoria</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-800 hover:to-cyan-400 transition-all shadow-lg"
        >
          <Plus size={20} />
          Novo Orçamento
        </button>
      </header>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
          Calculando seus limites e gastos...
        </div>
      ) : orcamentos.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 shadow-soft border border-slate-100 text-center dark:bg-slate-800 dark:border-slate-700">
          <Target className="w-16 h-16 text-blue-200 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-700 mb-2 dark:text-slate-200">Nenhum orçamento definido</h3>
          <p className="text-slate-500 mb-6 dark:text-slate-400">Comece criando um limite de gastos para categorias como Alimentação ou Lazer.</p>
          <button onClick={() => setShowModal(true)} className="text-blue-600 font-semibold hover:underline">
            Criar meu primeiro orçamento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {orcamentos.map((orc) => {
            const limite = Number(orc.limite_mensal) // <-- CORRIGIDO AQUI TAMBÉM!
            const gasto = Number(orc.valor_gasto_real)
            const porcentagem = limite > 0 ? (gasto / limite) * 100 : 0
            const passouDoLimite = porcentagem >= 100
            const emAlerta = porcentagem >= 80 && !passouDoLimite

            return (
              <div key={orc.id} className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 relative group overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <button 
                  onClick={() => handleExcluir(orc.id)}
                  className="absolute top-4 right-4 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all md:opacity-0 group-hover:opacity-100"
                  title="Excluir Orçamento"
                >
                  <Trash2 size={18} />
                </button>

                <div className="flex items-center gap-4 mb-6">
                  <div 
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl shadow-sm"
                    style={{ backgroundColor: orc.categorias?.cor || '#3b82f6' }}
                  >
                    {orc.categorias?.icone || '📁'}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg dark:text-slate-100">{orc.categorias?.nome || 'Geral'}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Limite: {formatarMoeda(limite)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-sm text-slate-500 mb-1 dark:text-slate-400">Total Gasto</p>
                      <p className={`text-2xl font-bold ${passouDoLimite ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>
                        {formatarMoeda(gasto)}
                      </p>
                    </div>
                    <div className="text-right">
                      {passouDoLimite ? (
                        <div className="flex items-center gap-1 text-red-500 text-sm font-semibold mb-1">
                          <AlertTriangle size={14} /> Estourou
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-green-500 text-sm font-semibold mb-1">
                          <CheckCircle size={14} /> {formatarMoeda(limite - gasto)} livre
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden dark:bg-slate-700">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        passouDoLimite ? 'bg-red-500' : emAlerta ? 'bg-amber-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'
                      }`}
                      style={{ width: `${Math.min(porcentagem, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-right text-xs text-slate-400 font-medium mt-1">
                    {porcentagem.toFixed(1)}% utilizado
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-strong w-full max-w-sm overflow-hidden animate-slide-in dark:bg-slate-800">
            <div className="bg-gradient-to-r from-blue-900 to-cyan-500 px-6 py-4 flex justify-between items-center text-white">
              <h2 className="font-bold text-lg">Novo Orçamento</h2>
            </div>

            <form onSubmit={handleSalvar} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Categoria</label>
                <select
                  required
                  value={novaCategoriaId}
                  onChange={(e) => setNovaCategoriaId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-slate-700 bg-white dark:border-slate-700 dark:text-slate-200 dark:bg-slate-800"
                >
                  <option value="">Selecione a categoria...</option>
                  {categorias.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Qual o limite mensal? (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={novoLimite}
                  onChange={(e) => setNovoLimite(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
                  placeholder="Ex: 800.00"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 border border-slate-200 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 transition-colors dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all flex justify-center items-center"
                >
                  {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}