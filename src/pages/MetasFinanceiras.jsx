import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { 
  Target, Plus, Trash2, TrendingUp, TrendingDown, Calendar, Loader2, X, Award, 
  Edit, Plane, Car, Home, Heart, ShoppingBag, Book, PiggyBank, Smartphone 
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { formatarMoeda } from '../utils/helpers'
import { useToast } from '../components/Toast'

const iconesDisponiveis = [
  { id: 'Target', Icon: Target },
  { id: 'PiggyBank', Icon: PiggyBank },
  { id: 'Plane', Icon: Plane },
  { id: 'Car', Icon: Car },
  { id: 'Home', Icon: Home },
  { id: 'Heart', Icon: Heart },
  { id: 'ShoppingBag', Icon: ShoppingBag },
  { id: 'Smartphone', Icon: Smartphone },
  { id: 'Book', Icon: Book },
]

export default function MetasFinanceiras() {
  const toast = useToast()
  const [metas, setMetas] = useState([])
  const [loading, setLoading] = useState(true)
  
  const [showNovaMetaModal, setShowNovaMetaModal] = useState(false)
  const [showEditarModal, setShowEditarModal] = useState(false)
  const [showMovimentoModal, setShowMovimentoModal] = useState(false)
  
  const [salvando, setSalvando] = useState(false)
  const [metaSelecionada, setMetaSelecionada] = useState(null)
  const [tipoMovimento, setTipoMovimento] = useState('depositar') 
  const [valorMovimento, setValorMovimento] = useState('')
  
  const [novaMeta, setNovaMeta] = useState({
    titulo: '',
    valor_objetivo: '',
    data_limite: '',
    cor: '#3b82f6',
    icone: 'Target'
  })

  const [metaEditando, setMetaEditando] = useState(null)

  const coresDisponiveis = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#f43f5e']

  const carregarMetas = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('metas').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setMetas(data || [])
    } catch (error) {
      console.error("Erro ao carregar metas:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarMetas() }, [])

  // --- NOVA MÁSCARA MONETÁRIA INTELIGENTE (Padrão PIX) ---
  const aplicarMascaraMoeda = (valor) => {
    if (!valor) return ''
    const apenasNumeros = valor.toString().replace(/\D/g, '')
    if (apenasNumeros === '') return ''
    const valorFloat = parseInt(apenasNumeros, 10) / 100
    return valorFloat.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // --- FUNÇÃO PARA CONVERTER A STRING PT-BR DE VOLTA PARA FLOAT DO BANCO ---
  const converterParaFloat = (valorString) => {
    if (!valorString) return 0
    return parseFloat(valorString.replace(/\./g, '').replace(',', '.'))
  }

  const handleSalvarMeta = async (e) => {
    e.preventDefault()
    setSalvando(true)
    
    try {
      const valorObj = converterParaFloat(novaMeta.valor_objetivo)
      if (isNaN(valorObj) || valorObj <= 0) { toast.warning('Digite um valor válido.'); setSalvando(false); return }

      const { error } = await supabase.from('metas').insert([{
        titulo: novaMeta.titulo,
        valor_objetivo: valorObj,
        data_limite: novaMeta.data_limite || null,
        cor: novaMeta.cor,
        icone: novaMeta.icone,
        valor_atual: 0
      }])

      if (error) throw error

      setShowNovaMetaModal(false)
      setNovaMeta({ titulo: '', valor_objetivo: '', data_limite: '', cor: '#3b82f6', icone: 'Target' })
      toast.success('Meta criada com sucesso!')
      carregarMetas()
    } catch (error) {
      toast.error('Erro ao criar meta. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const handleEditarMeta = async (e) => {
    e.preventDefault()
    setSalvando(true)
    
    try {
      const valorObj = converterParaFloat(metaEditando.valor_objetivo)
      if (isNaN(valorObj) || valorObj <= 0) { toast.warning('Digite um valor válido.'); setSalvando(false); return }

      const { error } = await supabase.from('metas').update({
        titulo: metaEditando.titulo,
        valor_objetivo: valorObj,
        data_limite: metaEditando.data_limite || null,
        cor: metaEditando.cor,
        icone: metaEditando.icone
      }).eq('id', metaEditando.id)

      if (error) throw error

      setShowEditarModal(false)
      setMetaEditando(null)
      toast.success('Meta atualizada com sucesso!')
      carregarMetas()
    } catch (error) {
      toast.error('Erro ao editar meta. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const handleMovimentar = async (e) => {
    e.preventDefault()
    setSalvando(true)
    
    try {
      const valor = converterParaFloat(valorMovimento)
      if (isNaN(valor) || valor <= 0) { toast.warning('Digite um valor válido.'); setSalvando(false); return }

      if (tipoMovimento === 'resgatar' && valor > metaSelecionada.valor_atual) {
        setSalvando(false)
        { toast.warning('Valor de resgate maior do que o saldo guardado!'); setSalvando(false); return }
      }

      const novoValorAtual = tipoMovimento === 'depositar' 
        ? Number(metaSelecionada.valor_atual) + valor 
        : Number(metaSelecionada.valor_atual) - valor

      const { error: erroMeta } = await supabase.from('metas').update({ valor_atual: novoValorAtual }).eq('id', metaSelecionada.id)
      if (erroMeta) throw erroMeta

      let idCategoriaInvestimento = null
      try {
        const tipoStr = tipoMovimento === 'depositar' ? 'despesa' : 'receita'
        const { data: categorias } = await supabase.from('categorias').select('id').ilike('nome', 'Investimento').eq('tipo', tipoStr)
        if (categorias && categorias.length > 0) {
          idCategoriaInvestimento = categorias[0].id
        } else {
          const { data: novaCategoria } = await supabase.from('categorias').insert([{ nome: 'Investimento', tipo: tipoStr }]).select()
          if (novaCategoria && novaCategoria.length > 0) idCategoriaInvestimento = novaCategoria[0].id
        }
      } catch (err) {
        console.error("Não foi possível atribuir a categoria Investimento.", err)
      }

      const { error: erroTransacao } = await supabase.from('transacoes').insert([{
        tipo: tipoMovimento === 'depositar' ? 'despesa' : 'receita',
        descricao: tipoMovimento === 'depositar' ? `Investimento: ${metaSelecionada.titulo}` : `Resgate: ${metaSelecionada.titulo}`,
        valor: valor,
        data_transacao: new Date().toISOString().split('T')[0],
        categoria_id: idCategoriaInvestimento
      }])

      if (erroTransacao) throw erroTransacao

      setShowMovimentoModal(false)
      setValorMovimento('')
      setMetaSelecionada(null)
      toast.success(tipoMovimento === 'depositar' ? 'Depósito realizado!' : 'Resgate realizado!')
      carregarMetas()
    } catch (error) {
      toast.error('Erro ao processar a movimentação. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const handleExcluir = async (id, titulo) => {
    if (!window.confirm(`Deseja realmente excluir a meta "${titulo}"? O valor guardado continuará nas transações. Para estornar ao saldo geral, use o botão "Resgatar" antes de excluir a meta.`)) return
    
    try {
      await supabase.from('metas').delete().eq('id', id)
      carregarMetas()
    } catch (error) {
      toast.error('Erro ao excluir meta. Tente novamente.')
    }
  }

  
  const formatarData = (dataString) => {
    if (!dataString) return 'Sem data limite'
    const dateObj = new Date(dataString + 'T12:00:00')
    return dateObj.toLocaleDateString('pt-BR')
  }

  const renderizarIcone = (iconeNome) => {
    const IconeEncontrado = iconesDisponiveis.find(i => i.id === iconeNome)?.Icon || Target
    return <IconeEncontrado size={28} strokeWidth={2.5} />
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in pb-24">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3 dark:text-slate-100">
            <Target className="text-blue-600" size={32} />
            Metas Financeiras
          </h1>
          <p className="text-slate-500 mt-2 dark:text-slate-400">Guarde dinheiro em seus cofres e realize sonhos</p>
        </div>
        <button 
          onClick={() => setShowNovaMetaModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <Plus size={20} /> Nova Meta
        </button>
      </header>

      {loading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-3 dark:text-slate-400">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500" /> Carregando metas...
        </div>
      ) : metas.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl text-center text-slate-500 shadow-soft border border-dashed border-slate-300 dark:bg-slate-800 dark:text-slate-400">
          Você ainda não tem nenhum cofre. Clique no botão acima para criar o seu primeiro objetivo!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {metas.map(meta => {
            const progresso = Math.min((meta.valor_atual / meta.valor_objetivo) * 100, 100)
            const metaAtingida = progresso >= 100

            return (
              <div key={meta.id} className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 relative group overflow-hidden flex flex-col h-full dark:bg-slate-800 dark:border-slate-700">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-10 pointer-events-none" style={{ backgroundColor: meta.cor }}></div>
                
                <div className="absolute top-4 right-4 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => { 
                      setMetaEditando({
                        ...meta,
                        // Formata o valor antes de jogar pro Modal
                        valor_objetivo: aplicarMascaraMoeda(meta.valor_objetivo)
                      }); 
                      setShowEditarModal(true);
                    }}
                    className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors dark:hover:bg-slate-700"
                    title="Editar Meta"
                  >
                    <Edit size={20} />
                  </button>
                  <button 
                    onClick={() => handleExcluir(meta.id, meta.titulo)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    title="Excluir Meta"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-6 pr-16">
                  <div className="w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-white shadow-md" style={{ backgroundColor: meta.cor }}>
                    {metaAtingida ? <Award size={28} strokeWidth={2.5} /> : renderizarIcone(meta.icone)}
                  </div>
                  <div className="truncate">
                    <h3 className="text-xl font-bold text-slate-800 truncate dark:text-slate-100" title={meta.titulo}>{meta.titulo}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1 dark:text-slate-400">
                      <Calendar size={14} /> {formatarData(meta.data_limite)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-6 flex-1">
                  <div className="flex justify-between items-end">
                    <p className="text-3xl font-bold truncate" style={{ color: meta.cor }}>
                      {formatarMoeda(meta.valor_atual)}
                    </p>
                    <p className="text-sm font-semibold text-slate-500 mb-1 ml-2 dark:text-slate-400">
                      de {formatarMoeda(meta.valor_objetivo)}
                    </p>
                  </div>
                  
                  <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden relative dark:bg-slate-700">
                    <div 
                      className="h-full rounded-full transition-all duration-1000 ease-out relative"
                      style={{ width: `${progresso}%`, backgroundColor: meta.cor }}
                    >
                      <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>{progresso.toFixed(1)}% concluído</span>
                    {metaAtingida && <span className="text-green-600 font-bold">Meta Atingida! 🎉</span>}
                  </div>
                </div>

                <div className="flex gap-3 mt-auto">
                  {!metaAtingida && (
                    <button 
                      onClick={() => { setMetaSelecionada(meta); setTipoMovimento('depositar'); setShowMovimentoModal(true) }}
                      className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 border border-slate-200 shadow-sm dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                    >
                      <TrendingUp size={18} /> Guardar
                    </button>
                  )}
                  {meta.valor_atual > 0 && (
                    <button 
                      onClick={() => { setMetaSelecionada(meta); setTipoMovimento('resgatar'); setShowMovimentoModal(true) }}
                      className="flex-1 py-2.5 bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 border border-slate-200 hover:border-red-200 shadow-sm dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                    >
                      <TrendingDown size={18} /> Resgatar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL 1: Nova Meta */}
      {showNovaMetaModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] dark:bg-slate-800">
            <div className="shrink-0 bg-gradient-to-r from-blue-900 to-cyan-500 px-6 py-4 flex items-center justify-between text-white">
              <h2 className="font-bold text-lg flex items-center gap-2"><Target size={20} /> Novo Cofre</h2>
              <button onClick={() => setShowNovaMetaModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleSalvarMeta} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Título da Meta</label>
                <input required autoFocus type="text" value={novaMeta.titulo} onChange={e => setNovaMeta({...novaMeta, titulo: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:border-slate-700" placeholder="Ex: Viagem, Carro..." />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Valor Objetivo</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                  <input 
                    required 
                    type="text" 
                    value={novaMeta.valor_objetivo} 
                    onChange={e => setNovaMeta({...novaMeta, valor_objetivo: aplicarMascaraMoeda(e.target.value)})} 
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100" 
                    placeholder="0,00" 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Data Limite (Opcional)</label>
                <input type="date" value={novaMeta.data_limite} onChange={e => setNovaMeta({...novaMeta, data_limite: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-200">Escolha um Ícone</label>
                <div className="flex flex-wrap gap-2">
                  {iconesDisponiveis.map(({ id, Icon }) => (
                    <button 
                      key={id} 
                      type="button" 
                      onClick={() => setNovaMeta({...novaMeta, icone: id})} 
                      className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center ${novaMeta.icone === id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}
                    >
                      <Icon size={20} strokeWidth={2.5} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-200">Cor de Destaque</label>
                <div className="flex flex-wrap gap-3">
                  {coresDisponiveis.map(cor => (
                    <button key={cor} type="button" onClick={() => setNovaMeta({...novaMeta, cor})} className={`w-8 h-8 rounded-full shadow-sm ${novaMeta.cor === cor ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-110 transition-transform'}`} style={{ backgroundColor: cor }} />
                  ))}
                </div>
              </div>
              
              <button type="submit" disabled={salvando} className="w-full py-3.5 mt-2 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2">
                {salvando ? <Loader2 className="animate-spin w-5 h-5"/> : 'Criar Cofre'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Editar Meta (Padronizado e Bonito) */}
      {showEditarModal && metaEditando && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] dark:bg-slate-800">
            <div className="shrink-0 bg-gradient-to-r from-blue-900 to-cyan-500 px-6 py-4 flex items-center justify-between text-white">
              <h2 className="font-bold text-lg flex items-center gap-2"><Edit size={20} /> Editar Meta</h2>
              <button onClick={() => { setShowEditarModal(false); setMetaEditando(null) }} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleEditarMeta} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Título da Meta</label>
                <input required autoFocus type="text" value={metaEditando.titulo} onChange={e => setMetaEditando({...metaEditando, titulo: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:border-slate-700" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Valor Objetivo</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                  <input 
                    required 
                    type="text" 
                    value={metaEditando.valor_objetivo} 
                    onChange={e => setMetaEditando({...metaEditando, valor_objetivo: aplicarMascaraMoeda(e.target.value)})} 
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100" 
                    placeholder="0,00"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Data Limite (Opcional)</label>
                <input type="date" value={metaEditando.data_limite || ''} onChange={e => setMetaEditando({...metaEditando, data_limite: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-200">Escolha um Ícone</label>
                <div className="flex flex-wrap gap-2">
                  {iconesDisponiveis.map(({ id, Icon }) => (
                    <button 
                      key={id} 
                      type="button" 
                      onClick={() => setMetaEditando({...metaEditando, icone: id})} 
                      className={`w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center ${metaEditando.icone === id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400' : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}
                    >
                      <Icon size={20} strokeWidth={2.5} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-200">Cor de Destaque</label>
                <div className="flex flex-wrap gap-3">
                  {coresDisponiveis.map(cor => (
                    <button key={cor} type="button" onClick={() => setMetaEditando({...metaEditando, cor})} className={`w-8 h-8 rounded-full shadow-sm ${metaEditando.cor === cor ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-110 transition-transform'}`} style={{ backgroundColor: cor }} />
                  ))}
                </div>
              </div>
              
              <button type="submit" disabled={salvando} className="w-full py-3.5 mt-2 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2">
                {salvando ? <Loader2 className="animate-spin w-5 h-5"/> : 'Salvar Alterações'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: Movimentação (Guardar/Resgatar com Mascara Moeda) */}
      {showMovimentoModal && metaSelecionada && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col dark:bg-slate-800">
            <div 
              className="shrink-0 px-6 py-4 flex items-center justify-between text-white rounded-t-3xl" 
              style={{ backgroundColor: tipoMovimento === 'depositar' ? metaSelecionada.cor : '#dc2626' }}
            >
              <h2 className="font-bold text-lg flex items-center gap-2">
                {tipoMovimento === 'depositar' ? <><TrendingUp size={20} /> Guardar Dinheiro</> : <><TrendingDown size={20} /> Resgatar Dinheiro</>}
              </h2>
              <button onClick={() => setShowMovimentoModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleMovimentar} className="p-6">
              <p className="text-center text-slate-500 mb-4 text-sm dark:text-slate-400">
                Quanto você quer {tipoMovimento === 'depositar' ? 'adicionar no cofre' : 'resgatar do cofre'}<br/>
                <strong className="text-slate-800 text-base dark:text-slate-100">{metaSelecionada.titulo}</strong>?
              </p>
              
              {tipoMovimento === 'resgatar' && (
                <p className="text-xs text-center text-red-500 mb-4 font-semibold">
                  Saldo disponível no cofre: {formatarMoeda(metaSelecionada.valor_atual)}
                </p>
              )}

              <div className="relative mb-6">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xl">R$</span>
                <input 
                  required 
                  type="text" 
                  value={valorMovimento} 
                  onChange={e => setValorMovimento(aplicarMascaraMoeda(e.target.value))} 
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-slate-200 font-bold text-3xl text-slate-800 text-center dark:border-slate-700 dark:text-slate-100" 
                  autoFocus 
                  placeholder="0,00" 
                />
              </div>
              <button 
                type="submit" 
                disabled={salvando} 
                className="w-full py-4 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg flex justify-center items-center gap-2" 
                style={{ backgroundColor: tipoMovimento === 'depositar' ? metaSelecionada.cor : '#dc2626' }}
              >
                {salvando ? <Loader2 className="animate-spin w-5 h-5"/> : 'Confirmar'}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer { 100% { transform: translateX(100%); } }
      `}} />
    </div>
  )
}