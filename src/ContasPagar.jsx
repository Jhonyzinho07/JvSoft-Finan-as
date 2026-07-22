import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { formatarMoeda } from './utils/helpers'
import { useToast } from './components/Toast'
import { 
  CheckCircle, XCircle, Calendar, DollarSign, TrendingDown, 
  AlertTriangle, RefreshCw, Trash2, Plus, X, Loader2, 
  Tag, Repeat, ChevronLeft, ChevronRight, Pencil
} from 'lucide-react'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function ContasPagar() {
  const toast = useToast()
  const dataHoje = new Date()

  const [contas, setContas] = useState([])
  const [categorias, setCategorias] = useState([]) 
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)
  const [totais, setTotais] = useState({ geral: 0, pago: 0, pendente: 0 })

  // Controle de Navegação de Meses
  const [mesAtual, setMesAtual] = useState(dataHoje.getMonth())
  const [anoAtual, setAnoAtual] = useState(dataHoje.getFullYear())

  // Estados dos Modais
  const [salvando, setSalvando] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [novaConta, setNovaConta] = useState({ descricao: '', valor: '', data_vencimento: '', categoria_id: '', parcelas: '1' })
  
  // Novos Estados para Modais de Confirmação
  const [modalPagar, setModalPagar] = useState({ show: false, conta: null })
  const [modalExcluir, setModalExcluir] = useState({ show: false, conta: null, escopo: 'unica' })
  const [modalEditar, setModalEditar] = useState({ show: false, conta: null })
  const [contaEditando, setContaEditando] = useState({ descricao: '', valor: '', data_vencimento: '', categoria_id: '' })

  // --- MÁSCARAS MONETÁRIAS ---
  const aplicarMascaraMoeda = (valor) => {
    if (!valor) return ''
    const apenasNumeros = valor.toString().replace(/\D/g, '')
    if (apenasNumeros === '') return ''
    const valorFloat = parseInt(apenasNumeros, 10) / 100
    return valorFloat.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const converterParaFloat = (valorString) => {
    if (!valorString) return 0
    return parseFloat(valorString.toString().replace(/\./g, '').replace(',', '.'))
  }


  const carregarCategorias = async () => {
    const { data } = await supabase.from('categorias').select('id, nome').eq('tipo', 'despesa')
    if (data) setCategorias(data)
  }

  const carregarContas = async () => {
    setLoading(true)
    setErro(null)
    
    try {
      const primeiroDia = new Date(anoAtual, mesAtual, 1).toISOString().split('T')[0]
      const ultimoDia = new Date(anoAtual, mesAtual + 1, 0).toISOString().split('T')[0]

      const { data: contasConsumo, error: errorContas } = await supabase
        .from('contas')
        .select(`*, credores:credor_id (nome, emoji, cor), categorias (nome)`)
        .gte('data_vencimento', primeiroDia)
        .lte('data_vencimento', ultimoDia)
        .order('dia_vencimento', { ascending: true }) 

      if (errorContas) throw new Error(`Erro ao buscar contas: ${errorContas.message}`)

      const { data: dividasParceladas, error: errorDividas } = await supabase
        .from('dividas')
        .select(`*, credores:credor_id (nome, emoji, cor)`)
        .gt('parcelas_restantes', 0) 

      if (errorDividas) throw new Error(`Erro ao buscar dívidas: ${errorDividas.message}`)

      const todasContas = []

      if (contasConsumo) {
        todasContas.push(...contasConsumo.map(c => {
             const vencimentoFormatado = c.dia_vencimento ? `Dia ${String(c.dia_vencimento).padStart(2, '0')}` : 'Sem data'
          return {
            id: c.id,
            credor: c.categorias?.nome || c.credores?.nome || 'Outros',
            emoji: c.credores?.emoji || '💰',
            cor: c.credores?.cor || '#6b7280',
            descricao: c.descricao,
            valor: c.valor,
            vencimento: vencimentoFormatado,
            status_pago: c.status_pago,
            tipo: 'consumo',
            categoria_id: c.categoria_id, 
            dia_ordenacao: c.dia_vencimento || 99,
            db_table: 'contas',
            id_parcelamento: c.id_parcelamento || null,
            numero_parcela: c.numero_parcela || null,
            total_parcelas: c.total_parcelas || null
          }
        }))
      }

      if (dividasParceladas) {
        todasContas.push(...dividasParceladas.map(d => ({
          id: d.id,
          credor: d.credores?.nome || 'Outros',
          emoji: d.credores?.emoji || '💰',
          cor: d.credores?.cor || '#6b7280',
          descricao: d.descricao,
          valor: d.valor_parcela,
          vencimento: d.dia_vencimento ? `Dia ${String(d.dia_vencimento).padStart(2, '0')}` : 'À vista',
          status_pago: false, 
          tipo: 'parcela',
          categoria_id: null, 
          dia_ordenacao: d.dia_vencimento || 99,
          parcelas_restantes: d.parcelas_restantes,
          db_table: 'dividas'
        })))
      }

      todasContas.sort((a, b) => a.dia_ordenacao - b.dia_ordenacao)

      setContas(todasContas)
      const geral = todasContas.reduce((acc, c) => acc + Number(c.valor), 0)
      const pago = todasContas.filter(c => c.status_pago).reduce((acc, c) => acc + Number(c.valor), 0)
      setTotais({ geral, pago, pendente: geral - pago })

    } catch (err) {
      console.error("ERRO DETALHADO:", err)
      setErro(err.message)
    } finally {
      setLoading(false)
    }
  }

  // --- NAVEGAÇÃO DE MESES ---
  const alterarMes = (delta) => {
    let novoMes = mesAtual + delta
    let novoAno = anoAtual
    
    if (novoMes > 11) {
      novoMes = 0
      novoAno++
    } else if (novoMes < 0) {
      novoMes = 11
      novoAno--
    }
    
    setMesAtual(novoMes)
    setAnoAtual(novoAno)
  }

  useEffect(() => {
    carregarCategorias() 
  }, [])

  useEffect(() => {
    carregarContas()
  }, [mesAtual, anoAtual])

  const handleSalvarConta = async (e) => {
    e.preventDefault()
    setSalvando(true)
    
    try {
      const valorFormatado = converterParaFloat(novaConta.valor)
      const totalParcelas = parseInt(novaConta.parcelas) || 1

      if (isNaN(valorFormatado) || valorFormatado <= 0 || !novaConta.data_vencimento) {
        toast.warning('Preencha o valor e a data de vencimento corretamente.')
        setSalvando(false)
        return
      }

      if (totalParcelas > 1) {
        const { error } = await supabase.rpc('criar_parcelamento', {
          p_descricao: novaConta.descricao,
          p_valor_total: valorFormatado,
          p_total_parcelas: totalParcelas,
          p_data_inicio: novaConta.data_vencimento,
          p_categoria_id: novaConta.categoria_id || null
        })
        if (error) throw error
      } else {
        const dataObj = new Date(novaConta.data_vencimento + 'T00:00:00')
        const { error } = await supabase.from('contas').insert([{
          descricao: novaConta.descricao,
          valor: valorFormatado,
          data_vencimento: novaConta.data_vencimento,
          dia_vencimento: dataObj.getDate(),
          categoria_id: novaConta.categoria_id || null,
          status_pago: false
        }])
        if (error) throw error
      }

      setShowModal(false)
      setNovaConta({ descricao: '', valor: '', data_vencimento: '', categoria_id: '', parcelas: '1' })
      toast.success(parseInt(novaConta.parcelas) > 1 ? `Parcelamento criado com ${novaConta.parcelas} parcelas!` : 'Conta adicionada com sucesso!')
      carregarContas()

    } catch (error) {
      console.error('Erro ao salvar conta:', error)
      toast.error('Erro ao salvar a conta. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const abrirEditar = (conta) => {
    setContaEditando({
      descricao: conta.descricao,
      valor: aplicarMascaraMoeda(String(Math.round(conta.valor * 100))),
      data_vencimento: conta.data_vencimento || '',
      categoria_id: conta.categoria_id || ''
    })
    setModalEditar({ show: true, conta })
  }

  const handleSalvarEdicao = async (e) => {
    e.preventDefault()
    setSalvando(true)
    try {
      const valorFormatado = converterParaFloat(contaEditando.valor)
      if (isNaN(valorFormatado) || valorFormatado <= 0 || !contaEditando.data_vencimento) {
        toast.warning('Preencha o valor e a data corretamente.')
        setSalvando(false)
        return
      }
      const dataObj = new Date(contaEditando.data_vencimento + 'T00:00:00')
      const { error } = await supabase.from('contas').update({
        descricao: contaEditando.descricao,
        valor: valorFormatado,
        data_vencimento: contaEditando.data_vencimento,
        dia_vencimento: dataObj.getDate(),
        categoria_id: contaEditando.categoria_id || null,
      }).eq('id', modalEditar.conta.id)
      if (error) throw error
      toast.success('Conta atualizada com sucesso!')
      setModalEditar({ show: false, conta: null })
      carregarContas()
    } catch (err) {
      console.error('Erro ao editar conta:', err)
      toast.error('Não foi possível salvar as alterações. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // Confirmar Pagamento
  const confirmarPagamento = async () => {
    const { conta } = modalPagar
    if (!conta) return
    setSalvando(true)

    if (conta.status_pago && conta.tipo === 'parcela') {
      toast.warning('Esta parcela já foi processada e não pode ser desfeita.')
      setSalvando(false)
      setModalPagar({ show: false, conta: null })
      return
    }

    const novoStatus = !conta.status_pago

    try {
      if (conta.tipo === 'consumo') {
        const { error } = await supabase.from('contas').update({ status_pago: novoStatus }).eq('id', conta.id)
        if (error) throw error
      } else if (conta.tipo === 'parcela' && novoStatus === true) {
        const novasParcelas = conta.parcelas_restantes - 1
        const { error } = await supabase.from('dividas').update({ parcelas_restantes: novasParcelas }).eq('id', conta.id)
        if (error) throw error
      }

      if (novoStatus === true) {
        const { error: errorTransacao } = await supabase.from('transacoes').insert([{
          tipo: 'despesa',
          descricao: `Pgto: ${conta.descricao}`,
          valor: conta.valor,
          data_transacao: new Date().toISOString().split('T')[0],
          categoria_id: conta.categoria_id || null,
          conta_vinculada_id: conta.id // vínculo exato p/ permitir estorno seguro (não mais por descrição+valor)
        }])
        if (errorTransacao) throw errorTransacao
      } else {
        // Estorno pelo vínculo exato — evita apagar a transação de outra conta com mesma descrição/valor
        const { error: errorEstorno } = await supabase.from('transacoes')
          .delete()
          .eq('conta_vinculada_id', conta.id)
        if (errorEstorno) throw errorEstorno
      }

      toast.success(novoStatus ? 'Pagamento registrado com sucesso!' : 'Pagamento desfeito.')
      carregarContas()
      setModalPagar({ show: false, conta: null })
    } catch (err) {
      console.error("Erro ao atualizar status:", err)
      toast.error('Não foi possível processar o pagamento. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  // --- FUNÇÃO DE EXCLUSÃO CORRIGIDA ---
  const confirmarExclusao = async () => {
    const { conta, escopo } = modalExcluir
    if (!conta) return
    setSalvando(true)

    try {
      if (conta.tipo === 'consumo' && conta.id_parcelamento) {
        if (escopo === 'todas') {
          // Solução direta pelo Front-End sem depender de função complexa no banco!
          // Ele encontra todas as contas pendentes da mesma compra e deleta de uma vez.
          const { error } = await supabase
            .from('contas')
            .delete()
            .eq('id_parcelamento', conta.id_parcelamento)
            .eq('status_pago', false) // Apaga apenas o que ainda não foi pago!
            
          if (error) throw error
        } else {
          // Exclui apenas uma parcela específica
          const { error } = await supabase.from('contas').delete().eq('id', conta.id)
          if (error) throw error
        }
      } else {
        // Exclusão de contas avulsas ou dívidas antigas
        if (conta.tipo === 'consumo') {
          const { error } = await supabase.from('contas').delete().eq('id', conta.id)
          if (error) throw error
        } else if (conta.tipo === 'parcela') {
          const { error } = await supabase.from('dividas').delete().eq('id', conta.id)
          if (error) throw error
        }
      }

      // Se a conta estava paga e você a excluiu, removemos a transação também (Estorno)
      // Usa o vínculo exato (conta_vinculada_id) em vez de descrição+valor, evitando apagar a transação errada
      if (conta.status_pago) {
        const { error: errorEstorno } = await supabase.from('transacoes')
          .delete()
          .eq('conta_vinculada_id', conta.id)
        if (errorEstorno) throw errorEstorno
      }

      toast.success(modalExcluir.escopo === 'parcelamento' ? 'Parcelamento excluído com sucesso!' : 'Conta excluída com sucesso!')
      carregarContas()
      setModalExcluir({ show: false, conta: null, escopo: 'unica' })
    } catch (err) {
      console.error("Erro ao excluir conta:", err)
      toast.error('Não foi possível excluir a conta. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  const contasAgrupadas = contas.reduce((acc, conta) => {
    if (!acc[conta.vencimento]) acc[conta.vencimento] = []
    acc[conta.vencimento].push(conta)
    return acc
  }, {})

  const datasOrdenadas = Object.keys(contasAgrupadas).sort((a, b) => {
    const numA = a.includes('Dia') ? parseInt(a.replace('Dia ', '')) : 99
    const numB = b.includes('Dia') ? parseInt(b.replace('Dia ', '')) : 99
    return numA - numB
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center dark:bg-slate-900">
        <div className="text-center">
          <RefreshCw className="animate-spin text-blue-600 mx-auto mb-4" size={48} />
          <p className="text-gray-600 font-medium dark:text-slate-300">Carregando suas contas...</p>
        </div>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 dark:bg-slate-900">
        <div className="bg-red-50 border border-red-200 p-8 rounded-2xl max-w-lg text-center shadow-lg">
          <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold text-red-700 mb-2">Erro ao carregar dados</h2>
          <p className="text-red-600 mb-6 text-sm bg-white p-3 rounded border border-red-100 dark:bg-slate-800">{erro}</p>
          <button onClick={carregarContas} className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-medium flex items-center gap-2 mx-auto">
            <RefreshCw size={16} /> Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto pb-24">
        
        <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2 dark:text-slate-100">
              <Calendar className="text-blue-600" size={32} />
              Contas a Pagar
            </h1>
            <p className="text-gray-500 mt-2 dark:text-slate-400">Controle de pagamentos de contas avulsas e parcelamentos</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-800 hover:to-cyan-400 transition-all shadow-lg"
          >
            <Plus size={20} />
            Nova Conta
          </button>
        </header>

        {/* BARRA DE NAVEGAÇÃO DE MESES */}
        <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-100 mb-8 dark:bg-slate-800 dark:border-slate-700">
          <button onClick={() => alterarMes(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600 dark:text-slate-300">
            <ChevronLeft size={24} />
          </button>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {MESES[mesAtual]} {anoAtual}
          </h2>
          <button onClick={() => alterarMes(1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600 dark:text-slate-300">
            <ChevronRight size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-md border-l-4 border-blue-500 dark:bg-slate-800">
            <div className="flex items-center gap-2 text-gray-500 mb-2 dark:text-slate-400">
              <DollarSign size={20} />
              <span className="text-sm font-medium">Total Geral</span>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-slate-100">
              {formatarMoeda(totais.geral)}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-md border-l-4 border-green-500 dark:bg-slate-800">
            <div className="flex items-center gap-2 text-gray-500 mb-2 dark:text-slate-400">
              <CheckCircle size={20} />
              <span className="text-sm font-medium">Total Pago</span>
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatarMoeda(totais.pago)}
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-md border-l-4 border-red-500 dark:bg-slate-800">
            <div className="flex items-center gap-2 text-gray-500 mb-2 dark:text-slate-400">
              <TrendingDown size={20} />
              <span className="text-sm font-medium">Total Pendente</span>
            </div>
            <p className="text-2xl font-bold text-red-600">
              {formatarMoeda(totais.pendente)}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {datasOrdenadas.length === 0 && (
            <div className="bg-white p-12 rounded-2xl text-center text-gray-500 shadow-md border border-dashed border-gray-300 dark:bg-slate-800 dark:text-slate-400">
              Nenhuma conta encontrada para <strong>{MESES[mesAtual]} de {anoAtual}</strong>.
            </div>
          )}
          
          {datasOrdenadas.map(data => (
            <div key={data} className="bg-white rounded-2xl shadow-md overflow-hidden animate-fade-in dark:bg-slate-800">
              <div className="bg-gray-100 px-6 py-3 border-b border-gray-200 dark:border-slate-700">
                <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2 dark:text-slate-200">
                  <Calendar size={20} className="text-blue-600" />
                  {data}
                </h2>
              </div>
              
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {contasAgrupadas[data].map(conta => (
                  <div key={conta.id} className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition-colors group ${conta.status_pago ? 'bg-green-50/50' : ''}`}>
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg shadow-sm" style={{ backgroundColor: conta.cor }}>
                        {conta.emoji}
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold ${conta.status_pago ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{conta.descricao}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm text-gray-500 dark:text-slate-400">{conta.credor}</span>
                          {conta.tipo === 'parcela' && (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                              Restam {conta.parcelas_restantes} parcelas
                            </span>
                          )}
                          {conta.tipo === 'consumo' && conta.total_parcelas > 1 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                              <Repeat size={12} /> Parcela {conta.numero_parcela}/{conta.total_parcelas}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <p className={`text-lg font-bold mr-2 ${conta.status_pago ? 'text-green-600 line-through' : 'text-gray-800'}`}>
                        {formatarMoeda(conta.valor)}
                      </p>

                      <button
                        onClick={() => setModalPagar({ show: true, conta })}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                          conta.status_pago 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-gray-800 text-white hover:bg-blue-600 shadow-md'
                        }`}
                      >
                        {conta.status_pago ? (
                          <><CheckCircle size={18} /> Pago</>
                        ) : (
                          <><XCircle size={18} /> Pagar</>
                        )}
                      </button>

                      <button
                        onClick={() => abrirEditar(conta)}
                        className="p-2 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all md:opacity-0 group-hover:opacity-100 dark:hover:bg-slate-700"
                        title="Editar Conta"
                      >
                        <Pencil size={18} />
                      </button>

                      <button
                        onClick={() => setModalExcluir({ show: true, conta, escopo: 'unica' })}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all md:opacity-0 group-hover:opacity-100"
                        title="Excluir Conta Definitivamente"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Nova Conta */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden dark:bg-slate-800">
            <div className="bg-gradient-to-r from-blue-900 to-cyan-500 px-6 py-4 flex items-center justify-between text-white">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Calendar size={20} /> Nova Conta a Pagar
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSalvarConta} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Descrição / Nome da Conta</label>
                <input 
                  type="text" 
                  required 
                  value={novaConta.descricao} 
                  onChange={(e) => setNovaConta({...novaConta, descricao: e.target.value})} 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all dark:border-slate-700" 
                  placeholder="Ex: Conta de Luz, Internet, etc." 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">
                    {parseInt(novaConta.parcelas) > 1 ? 'Valor Total (R$)' : 'Valor (R$)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                    <input 
                      type="text" 
                      required 
                      value={novaConta.valor} 
                      onChange={(e) => setNovaConta({...novaConta, valor: aplicarMascaraMoeda(e.target.value)})} 
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100" 
                      placeholder="0,00" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">
                    {parseInt(novaConta.parcelas) > 1 ? 'Data da 1ª Parcela' : 'Data do Vencimento'}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="date" 
                      required 
                      value={novaConta.data_vencimento} 
                      onChange={(e) => setNovaConta({...novaConta, data_vencimento: e.target.value})} 
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-700 text-sm dark:border-slate-700 dark:text-slate-200" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Número de Parcelas</label>
                <div className="relative">
                  <Repeat className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="number" 
                    min="1" 
                    value={novaConta.parcelas} 
                    onChange={(e) => setNovaConta({...novaConta, parcelas: e.target.value})} 
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800 font-semibold dark:border-slate-700 dark:text-slate-100" 
                    placeholder="1" 
                  />
                </div>
                {parseInt(novaConta.parcelas) > 1 && novaConta.valor && (
                  <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
                    {novaConta.parcelas}x de aproximadamente{' '}
                    {formatarMoeda(converterParaFloat(novaConta.valor) / parseInt(novaConta.parcelas))}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Categoria (Opcional)</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select 
                    value={novaConta.categoria_id} 
                    onChange={(e) => setNovaConta({...novaConta, categoria_id: e.target.value})} 
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white appearance-none dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Selecione uma categoria...</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={salvando} 
                className="w-full py-3.5 mt-4 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all flex justify-center items-center gap-2"
              >
                {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cadastrar Conta'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Pagamento */}
      {modalPagar.show && modalPagar.conta && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden dark:bg-slate-800">
            <div className={`bg-gradient-to-r ${modalPagar.conta.status_pago ? 'from-amber-500 to-orange-500' : 'from-green-500 to-emerald-500'} px-6 py-4 flex items-center justify-between text-white`}>
              <h2 className="font-bold text-lg flex items-center gap-2">
                {modalPagar.conta.status_pago ? <XCircle size={20} /> : <CheckCircle size={20} />}
                {modalPagar.conta.status_pago ? 'Desfazer Pagamento' : 'Confirmar Pagamento'}
              </h2>
              <button onClick={() => setModalPagar({ show: false, conta: null })} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 text-center">
              <p className="text-slate-600 mb-6 dark:text-slate-300">
                Deseja {modalPagar.conta.status_pago ? 'desfazer o pagamento de' : 'marcar como paga a conta de'} <strong className="text-slate-800 dark:text-slate-100">{modalPagar.conta.descricao}</strong> no valor de <strong className="text-slate-800 dark:text-slate-100">{formatarMoeda(modalPagar.conta.valor)}</strong>?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalPagar({ show: false, conta: null })}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarPagamento}
                  disabled={salvando}
                  className={`flex-1 py-3 text-white rounded-xl font-semibold shadow-lg transition-all flex justify-center items-center gap-2 ${modalPagar.conta.status_pago ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30' : 'bg-green-500 hover:bg-green-600 shadow-green-500/30'}`}
                >
                  {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {modalExcluir.show && modalExcluir.conta && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden dark:bg-slate-800">
            <div className="bg-gradient-to-r from-red-600 to-rose-500 px-6 py-4 flex items-center justify-between text-white">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Trash2 size={20} /> Excluir Conta
              </h2>
              <button onClick={() => setModalExcluir({ show: false, conta: null, escopo: 'unica' })} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              
              {modalExcluir.conta.tipo === 'consumo' && modalExcluir.conta.id_parcelamento ? (
                <>
                  <p className="text-slate-600 mb-4 text-center dark:text-slate-300">
                    A conta <strong className="text-slate-800 dark:text-slate-100">{modalExcluir.conta.descricao}</strong> faz parte de um parcelamento. O que deseja excluir?
                  </p>
                  <div className="space-y-3 mb-6">
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${modalExcluir.escopo === 'unica' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="escopoExclusao" value="unica" checked={modalExcluir.escopo === 'unica'} onChange={() => setModalExcluir({...modalExcluir, escopo: 'unica'})} className="w-4 h-4 text-red-600" />
                      <div>
                        <p className="font-semibold text-slate-800 text-sm dark:text-slate-100">Apenas esta parcela</p>
                        <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">Exclui apenas a parcela {modalExcluir.conta.numero_parcela}/{modalExcluir.conta.total_parcelas}.</p>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${modalExcluir.escopo === 'todas' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="escopoExclusao" value="todas" checked={modalExcluir.escopo === 'todas'} onChange={() => setModalExcluir({...modalExcluir, escopo: 'todas'})} className="w-4 h-4 text-red-600" />
                      <div>
                        <p className="font-semibold text-slate-800 text-sm dark:text-slate-100">Todas as pendentes</p>
                        <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">Cancela e exclui as parcelas futuras desta compra.</p>
                      </div>
                    </label>
                  </div>
                </>
              ) : (
                <p className="text-slate-600 mb-6 text-center dark:text-slate-300">
                  Tem certeza que deseja excluir permanentemente a conta <strong className="text-slate-800 dark:text-slate-100">{modalExcluir.conta.descricao}</strong>?
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalExcluir({ show: false, conta: null, escopo: 'unica' })}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarExclusao}
                  disabled={salvando}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold shadow-lg shadow-red-500/30 transition-all flex justify-center items-center gap-2"
                >
                  {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição de Conta */}
      {modalEditar.show && modalEditar.conta && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden dark:bg-slate-800">
            <div className="bg-gradient-to-r from-blue-900 to-cyan-500 px-6 py-4 flex items-center justify-between text-white">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Pencil size={20} /> Editar Conta
              </h2>
              <button onClick={() => setModalEditar({ show: false, conta: null })} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSalvarEdicao} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Descrição</label>
                <input
                  type="text" required
                  value={contaEditando.descricao}
                  onChange={(e) => setContaEditando({...contaEditando, descricao: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Valor (R$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                    <input
                      type="text" required
                      value={contaEditando.valor}
                      onChange={(e) => setContaEditando({...contaEditando, valor: aplicarMascaraMoeda(e.target.value)})}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-semibold text-slate-800 dark:border-slate-700 dark:text-slate-100"
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Data de Vencimento</label>
                  <input
                    type="date" required
                    value={contaEditando.data_vencimento}
                    onChange={(e) => setContaEditando({...contaEditando, data_vencimento: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-700 text-sm dark:border-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Categoria</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select
                    value={contaEditando.categoria_id}
                    onChange={(e) => setContaEditando({...contaEditando, categoria_id: e.target.value})}
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white appearance-none dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Sem categoria</option>
                    {categorias.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
              {modalEditar.conta?.total_parcelas > 1 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  ⚠️ Esta conta faz parte de um parcelamento. A edição afeta apenas esta parcela individual.
                </p>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalEditar({ show: false, conta: null })}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 transition-colors dark:text-slate-200">
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  className="flex-1 py-3 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl font-bold transition-all flex justify-center items-center gap-2">
                  {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default ContasPagar