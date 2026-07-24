import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CreditCard, Plus, Trash2, Loader2, Nfc, Edit, CheckCircle, X, DollarSign, Send, AlertTriangle } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { formatarMoeda } from '../utils/helpers'
import { useToast } from '../components/Toast'

export default function CartoesCredito() {
  const toast = useToast()
  const [cartoes, setCartoes] = useState([])
  const [contasPendentes, setContasPendentes] = useState([]) 
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  
  const [showModalNovo, setShowModalNovo] = useState(false)
  const [novoCartao, setNovoCartao] = useState({ nome: '', limite: '', fatura_atual: '', dia_fechamento: '', dia_vencimento: '', cor: '#1e40af' })

  const [modalGasto, setModalGasto] = useState({ show: false, cartao: null, valor: '' })
  const [modalEditar, setModalEditar] = useState({ show: false, cartao: null, limite: '' })
  const [modalFechar, setModalFechar] = useState({ show: false, cartao: null })

  const carregarCartoes = async () => {
    setLoading(true)
    
    const { data: cartoesData } = await supabase.from('cartoes').select('*').order('created_at', { ascending: true })
    const { data: contasData } = await supabase.from('contas').select('descricao, valor').eq('status_pago', false)

    setCartoes(cartoesData || [])
    setContasPendentes(contasData || [])
    
    setLoading(false)
  }

  useEffect(() => { carregarCartoes() }, [])

  const handleSalvarNovo = async (e) => {
    e.preventDefault()
    setSalvando(true)
    await supabase.from('cartoes').insert([{
      nome: novoCartao.nome,
      limite: parseFloat(novoCartao.limite.replace(',', '.')),
      fatura_atual: novoCartao.fatura_atual ? parseFloat(novoCartao.fatura_atual.replace(',', '.')) : 0,
      dia_fechamento: parseInt(novoCartao.dia_fechamento),
      dia_vencimento: parseInt(novoCartao.dia_vencimento),
      cor: novoCartao.cor
    }])
    setShowModalNovo(false)
    setNovoCartao({ nome: '', limite: '', fatura_atual: '', dia_fechamento: '', dia_vencimento: '', cor: '#1e40af' })
    carregarCartoes()
    setSalvando(false)
  }

  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este cartão?')) return
    await supabase.from('cartoes').delete().eq('id', id)
    carregarCartoes()
  }

  const confirmarGasto = async (e) => {
    e.preventDefault()
    setSalvando(true)
    try {
      const valorGasto = parseFloat(modalGasto.valor.replace(',', '.'))
      if (isNaN(valorGasto) || valorGasto <= 0) {
        toast.warning('Por favor, digite um valor válido.')
        setSalvando(false)
        return
      }

      await supabase.from('cartoes')
        .update({ fatura_atual: Number(modalGasto.cartao.fatura_atual) + valorGasto })
        .eq('id', modalGasto.cartao.id)
      
      setModalGasto({ show: false, cartao: null, valor: '' })
      carregarCartoes()
    } catch (error) {
      toast.error('Erro ao lançar gasto. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const confirmarEdicao = async (e) => {
    e.preventDefault()
    setSalvando(true)
    try {
      const novoLimite = parseFloat(modalEditar.limite.toString().replace(',', '.'))
      if (isNaN(novoLimite) || novoLimite <= 0) {
        toast.warning('Por favor, digite um valor válido.')
        setSalvando(false)
        return
      }

      await supabase.from('cartoes').update({ limite: novoLimite }).eq('id', modalEditar.cartao.id)
      
      setModalEditar({ show: false, cartao: null, limite: '' })
      carregarCartoes()
    } catch (error) {
      toast.error('Erro ao editar cartão. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const confirmarFechamento = async (e) => {
    e.preventDefault()
    setSalvando(true)
    try {
      const cartao = modalFechar.cartao
      
      // INTELIGÊNCIA DE CATEGORIA: Procura a categoria "Cartão", se não achar, cria.
      let cartaoCategoriaId = null
      
      try {
        const { data: categorias } = await supabase.from('categorias').select('id').ilike('nome', 'Cartão').eq('tipo', 'despesa')
        
        if (categorias && categorias.length > 0) {
          cartaoCategoriaId = categorias[0].id
        } else {
          // Cria a categoria caso ela não exista
          const { data: novaCategoria, error: errCategoria } = await supabase
            .from('categorias')
            .insert([{ nome: 'Cartão', tipo: 'despesa' }])
            .select()

          if (errCategoria) {
            // Código 23505 = violação da trava UNIQUE: outra aba/clique já
            // criou a categoria entre a busca e a criação. Buscamos a que
            // já existe em vez de falhar ou duplicar.
            if (errCategoria.code === '23505') {
              const { data: categoriaExistente } = await supabase
                .from('categorias').select('id').ilike('nome', 'Cartão').eq('tipo', 'despesa').limit(1)
              cartaoCategoriaId = categoriaExistente?.[0]?.id || null
            } else {
              throw errCategoria
            }
          } else if (novaCategoria && novaCategoria.length > 0) {
            cartaoCategoriaId = novaCategoria[0].id
          }
        }
      } catch (err) {
        console.error("Não foi possível processar a categoria. A fatura será salva sem categoria.", err)
      }
      
      // Calcula a data REAL de vencimento da fatura (não só o dia solto).
      // Se o dia de vencimento do cartão já passou neste mês, a fatura
      // vence no mês seguinte; senão, vence ainda neste mês.
      const hoje = new Date()
      let mesVencimento = hoje.getMonth()
      if (hoje.getDate() > cartao.dia_vencimento) {
        mesVencimento += 1
      }
      const dataVencimentoFatura = new Date(hoje.getFullYear(), mesVencimento, cartao.dia_vencimento)
        .toISOString().split('T')[0]

      // Envia a fatura com o ID da categoria que encontramos/criamos
      await supabase.from('contas').insert([{
        descricao: `Fatura: ${cartao.nome}`,
        valor: cartao.fatura_atual,
        data_vencimento: dataVencimentoFatura,
        dia_vencimento: cartao.dia_vencimento,
        categoria_id: cartaoCategoriaId,
        status_pago: false,
        status: 'pendente'
      }])

      await supabase.from('cartoes').update({ fatura_atual: 0 }).eq('id', cartao.id)

      setModalFechar({ show: false, cartao: null })
      carregarCartoes()
    } catch (error) {
      toast.error('Erro ao fechar fatura. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }


  const opcoesCores = [
    { nome: 'Azul Escuro', valor: '#1e40af' }, { nome: 'Roxo Nubank', valor: '#820ad1' },
    { nome: 'Laranja Inter', valor: '#f97316' }, { nome: 'Vermelho Santander', valor: '#dc2626' },
    { nome: 'Verde', valor: '#10b981' }, { nome: 'Preto Black', valor: '#171717' },
  ]

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in pb-24">
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3 dark:text-slate-100">
            <CreditCard className="text-blue-600" size={32} /> Meus Cartões
          </h1>
          <p className="text-slate-500 mt-2 dark:text-slate-400">Gerencie limites e feche faturas automaticamente</p>
        </div>
        <button onClick={() => setShowModalNovo(true)} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
          <Plus size={20} /> Novo Cartão
        </button>
      </header>

      {loading ? (
        <div className="p-12 text-center text-slate-500 flex justify-center dark:text-slate-400"><Loader2 className="animate-spin w-8 h-8"/></div>
      ) : cartoes.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl text-center text-slate-500 shadow-soft border border-dashed border-slate-300 dark:bg-slate-800 dark:text-slate-400">
          Nenhum cartão cadastrado. Clique em "Novo Cartão" para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {cartoes.map((cartao) => {
            
            const faturasFechadasPendentes = contasPendentes
              .filter(conta => conta.descricao === `Fatura: ${cartao.nome}`)
              .reduce((total, conta) => total + Number(conta.valor), 0)
            
            const limiteComprometido = Number(cartao.fatura_atual) + faturasFechadasPendentes
            const limiteRestante = Number(cartao.limite) - limiteComprometido
            const porcentagemUso = cartao.limite > 0 ? (limiteComprometido / cartao.limite) * 100 : 0
            const estourado = porcentagemUso >= 100

            return (
              <div key={cartao.id} className="relative group bg-white rounded-3xl p-4 shadow-soft border border-slate-100 flex flex-col h-full dark:bg-slate-800 dark:border-slate-700">
                
                <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                  <button onClick={() => setModalEditar({ show: true, cartao, limite: cartao.limite })} className="p-2 text-white/80 hover:text-white transition-colors" title="Editar Limite">
                    <Edit size={18} />
                  </button>
                  <button onClick={() => handleExcluir(cartao.id)} className="p-2 text-white/80 hover:text-red-300 transition-colors" title="Excluir Cartão">
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="rounded-2xl p-6 text-white shadow-lg relative overflow-hidden" style={{ backgroundColor: cartao.cor }}>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
                  <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4 pr-12">
                      <h3 className="text-xl font-bold tracking-wider truncate">{cartao.nome.toUpperCase()}</h3>
                      <Nfc size={24} className="opacity-70 flex-shrink-0" />
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-white/70 text-xs font-medium uppercase tracking-widest mb-1">Fatura Aberta</p>
                      <p className="text-3xl font-bold leading-none">{formatarMoeda(cartao.fatura_atual)}</p>
                      
                      {faturasFechadasPendentes > 0 && (
                        <div className="mt-2 inline-flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full text-xs font-medium text-white/90">
                          <AlertTriangle size={12} />
                          +{formatarMoeda(faturasFechadasPendentes)} aguardando pgto
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-end text-sm">
                      <div>
                        <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Limite Restante</p>
                        <p className={`font-semibold text-lg ${estourado ? 'text-red-300' : ''}`}>
                          {formatarMoeda(limiteRestante)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Vencimento</p>
                        <p className="font-semibold text-lg">Dia {cartao.dia_vencimento}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 px-2 flex-1 flex flex-col justify-end">
                  <div className="flex justify-between text-xs font-medium text-slate-500 mb-1 dark:text-slate-400">
                    <span>Uso do Limite</span>
                    <span>{Math.min(porcentagemUso, 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-4 dark:bg-slate-700">
                    <div className={`h-full rounded-full transition-all ${estourado ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(porcentagemUso, 100)}%` }}></div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setModalGasto({ show: true, cartao, valor: '' })} 
                      className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 border border-slate-200 shadow-sm dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                    >
                      <Plus size={16} /> Lançar Gasto
                    </button>
                    <button 
                      onClick={() => setModalFechar({ show: true, cartao })} 
                      disabled={cartao.fatura_atual <= 0} 
                      className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 border border-blue-200 shadow-sm disabled:opacity-50 disabled:grayscale dark:bg-slate-800"
                    >
                      <Send size={16} /> Fechar Fatura
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL 1: Novo Cartão */}
      {showModalNovo && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] dark:bg-slate-800">
            <div className="shrink-0 bg-gradient-to-r from-blue-900 to-cyan-500 px-6 py-4 flex items-center justify-between text-white rounded-t-3xl">
              <h2 className="font-bold text-lg flex items-center gap-2"><CreditCard size={20} /> Novo Cartão</h2>
              <button onClick={() => setShowModalNovo(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSalvarNovo} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Nome do Cartão</label>
                  <input type="text" required value={novoCartao.nome} onChange={(e) => setNovoCartao({...novoCartao, nome: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:border-slate-700" placeholder="Ex: Nubank, Itaú..." />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Limite Total (R$)</label>
                    <input type="number" step="0.01" required value={novoCartao.limite} onChange={(e) => setNovoCartao({...novoCartao, limite: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:border-slate-700" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Fatura Atual (R$)</label>
                    <input type="number" step="0.01" value={novoCartao.fatura_atual} onChange={(e) => setNovoCartao({...novoCartao, fatura_atual: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:border-slate-700" placeholder="Opcional" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Dia de Fechamento</label>
                    <input type="number" required value={novoCartao.dia_fechamento} onChange={(e) => setNovoCartao({...novoCartao, dia_fechamento: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:border-slate-700" placeholder="Ex: 5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Dia de Vencimento</label>
                    <input type="number" required value={novoCartao.dia_vencimento} onChange={(e) => setNovoCartao({...novoCartao, dia_vencimento: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:border-slate-700" placeholder="Ex: 10" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2 dark:text-slate-200">Cor do Cartão</label>
                  <div className="flex gap-2">
                    {opcoesCores.map(c => <button key={c.valor} type="button" onClick={() => setNovoCartao({...novoCartao, cor: c.valor})} className={`w-8 h-8 rounded-full shadow-sm hover:scale-110 transition-transform ${novoCartao.cor === c.valor ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : ''}`} style={{ backgroundColor: c.valor }} />)}
                  </div>
                </div>
                
                <button type="submit" disabled={salvando} className="w-full py-3.5 mt-2 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2">
                  {salvando ? <Loader2 className="animate-spin w-5 h-5"/> : 'Salvar Cartão'}
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Lançar Gasto (Agora com visual padronizado) */}
      {modalGasto.show && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col dark:bg-slate-800">
            <div className="shrink-0 bg-gradient-to-r from-blue-900 to-cyan-500 px-6 py-4 flex items-center justify-between text-white rounded-t-3xl">
              <h2 className="font-bold text-lg flex items-center gap-2"><Plus size={20} /> Lançar Compra</h2>
              <button onClick={() => setModalGasto({ show: false, cartao: null, valor: '' })} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4 dark:text-slate-400">Adicionando gasto no cartão <strong className="text-slate-800 dark:text-slate-100">{modalGasto.cartao?.nome}</strong></p>
              <form onSubmit={confirmarGasto} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Valor da Compra (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input autoFocus type="number" step="0.01" required value={modalGasto.valor} onChange={(e) => setModalGasto({...modalGasto, valor: e.target.value})} className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-lg font-semibold dark:border-slate-700" placeholder="0.00" />
                  </div>
                </div>
                <button type="submit" disabled={salvando} className="w-full py-3.5 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2">
                  {salvando ? <Loader2 className="animate-spin w-5 h-5"/> : 'Confirmar Gasto'}
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: Editar Limite (Agora com visual padronizado) */}
      {modalEditar.show && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col dark:bg-slate-800">
            <div className="shrink-0 bg-gradient-to-r from-blue-900 to-cyan-500 px-6 py-4 flex items-center justify-between text-white rounded-t-3xl">
              <h2 className="font-bold text-lg flex items-center gap-2"><Edit size={20} /> Editar Limite</h2>
              <button onClick={() => setModalEditar({ show: false, cartao: null, limite: '' })} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-500 mb-4 dark:text-slate-400">Atualizando o limite do <strong className="text-slate-800 dark:text-slate-100">{modalEditar.cartao?.nome}</strong></p>
              <form onSubmit={confirmarEdicao} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Novo Limite Total (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input autoFocus type="number" step="0.01" required value={modalEditar.limite} onChange={(e) => setModalEditar({...modalEditar, limite: e.target.value})} className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold dark:border-slate-700" placeholder="0.00" />
                  </div>
                </div>
                <button type="submit" disabled={salvando} className="w-full py-3.5 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2">
                  {salvando ? <Loader2 className="animate-spin w-5 h-5"/> : 'Salvar Alteração'}
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 4: Fechar Fatura (Agora com visual padronizado) */}
      {modalFechar.show && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col dark:bg-slate-800">
            <div className="shrink-0 bg-gradient-to-r from-blue-900 to-cyan-500 px-6 py-4 flex items-center justify-between text-white rounded-t-3xl">
              <h2 className="font-bold text-lg flex items-center gap-2"><Send size={20} /> Fechar Fatura</h2>
              <button onClick={() => setModalFechar({ show: false, cartao: null })} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} />
              </div>
              <h2 className="font-bold text-xl text-slate-800 mb-2 dark:text-slate-100">Confirma o Fechamento?</h2>
              <p className="text-slate-500 text-sm mb-6 dark:text-slate-400">
                O valor de <strong className="text-slate-800 dark:text-slate-100">{formatarMoeda(modalFechar.cartao?.fatura_atual)}</strong> será enviado para a tela de <strong>Contas a Pagar</strong>. <br/><br/>
                O limite deste cartão continuará bloqueado até que você registre o pagamento na outra tela.
              </p>
              
              <div className="flex gap-3">
                <button type="button" onClick={() => setModalFechar({ show: false, cartao: null })} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors dark:text-slate-200 dark:bg-slate-700">
                  Cancelar
                </button>
                <button type="button" onClick={confirmarFechamento} disabled={salvando} className="flex-1 py-3 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex justify-center items-center gap-2">
                  {salvando ? <Loader2 className="animate-spin w-5 h-5"/> : 'Sim, Fechar'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  )
}