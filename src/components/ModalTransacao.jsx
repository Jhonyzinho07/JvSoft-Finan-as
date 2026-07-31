import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useToast } from '../components/Toast'

export default function ModalTransacao({ onClose, tipoInicial = 'despesa' }) {
  const toast = useToast()
  const [tipo, setTipo] = useState(tipoInicial)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, _setData] = useState(new Date().toISOString().split('T')[0])
  const [categoriaId, setCategoriaId] = useState('')
  const [cartaoId, setCartaoId] = useState('')
  const [parcelas, setParcelas] = useState('1')
  const [categorias, setCategorias] = useState([])
  const [cartoes, setCartoes] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function carregarDados() {
      const { data: catData } = await supabase.from('categorias').select('id, nome, tipo')
      const { data: cartData } = await supabase.from('cartoes').select('id, nome, dia_vencimento')
      if (catData) setCategorias(catData)
      if (cartData) setCartoes(cartData)
    }
    carregarDados()
  }, [])

  const categoriasFiltradas = categorias.filter(c => c.tipo === tipo)

    const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const valorNumerico = parseFloat(valor.replace(',', '.'))
      
      const numParcelas = parseInt(parcelas) || 1

      if (tipo === 'despesa' && cartaoId && numParcelas > 1) {
        // Parcelamento no cartão
        const valorParcela = valorNumerico / numParcelas
        const cartaoSelecionado = cartoes.find(c => c.id === cartaoId)

        let transacoesParceladas = []

        // Data base para cálculo
        let dataBase = new Date()

        for (let i = 0; i < numParcelas; i++) {
          let dataVencimento = new Date(dataBase)
          // Avança os meses
          dataVencimento.setMonth(dataBase.getMonth() + i)

          // Se tiver dia_vencimento no cartão, ajusta
          if (cartaoSelecionado && cartaoSelecionado.dia_vencimento) {
            // Se hoje já passou do dia de vencimento, a primeira parcela é pro mês que vem
            let mesAjuste = dataBase.getMonth() + i
            if (i === 0 && dataBase.getDate() > cartaoSelecionado.dia_vencimento) {
              mesAjuste += 1
            }
            dataVencimento = new Date(dataBase.getFullYear(), mesAjuste, cartaoSelecionado.dia_vencimento)
          }

          transacoesParceladas.push({
            tipo,
            descricao: `${descricao} - Parcela ${i + 1}/${numParcelas}`,
            valor: parseFloat(valorParcela.toFixed(2)),
            data_transacao: dataVencimento.toISOString().split('T')[0],
            categoria_id: categoriaId || null,
            cartao_id: cartaoId
          })
        }

        const { error: errTrans } = await supabase.from('transacoes').insert(transacoesParceladas)
        if (errTrans) throw errTrans

        // Atualiza a fatura do cartão SOMENTE com o valor da primeira parcela
        const { data: cartaoAtual } = await supabase.from('cartoes').select('fatura_atual').eq('id', cartaoId).single()
        
        await supabase.from('cartoes')
          .update({ fatura_atual: Number(cartaoAtual.fatura_atual) + parseFloat(valorParcela.toFixed(2)) })
          .eq('id', cartaoId)

      } else {
        // Fluxo normal (sem parcelamento ou sem cartão)
        const { error: errTrans } = await supabase.from('transacoes').insert([{
          tipo,
          descricao,
          valor: valorNumerico,
          data_transacao: data,
          categoria_id: categoriaId || null,
          cartao_id: cartaoId || null // Se for null, sai do saldo. Se tiver ID, vai pro cartão.
        }])

        if (errTrans) throw errTrans

        // Se for despesa no cartão à vista (1 parcela), atualiza a fatura do cartão
        if (tipo === 'despesa' && cartaoId) {
          const { data: cartaoAtual } = await supabase.from('cartoes').select('fatura_atual').eq('id', cartaoId).single()

          await supabase.from('cartoes')
            .update({ fatura_atual: Number(cartaoAtual.fatura_atual) + valorNumerico })
            .eq('id', cartaoId)
        }
      }

      onClose()
      window.location.reload()
      
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Não foi possível salvar a transação. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-3xl shadow-float w-full max-w-md overflow-hidden border border-border">
        <div className={`bg-gradient-to-r ${tipo === 'receita' ? 'from-green-600 to-emerald-400' : 'from-red-600 to-rose-400'} px-6 py-4 flex items-center justify-between text-white`}>
          <h2 className="font-bold text-lg flex items-center gap-2">Nova Transação</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex bg-muted p-1 rounded-xl">
            <button type="button" onClick={() => setTipo('despesa')} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${tipo === 'despesa' ? 'bg-card border border-border text-red-600 dark:text-red-400 shadow-sm' : 'text-muted-foreground'}`}>Despesa</button>
            <button type="button" onClick={() => setTipo('receita')} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${tipo === 'receita' ? 'bg-card border border-border text-green-600 dark:text-green-400 shadow-sm' : 'text-muted-foreground'}`}>Receita</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descrição</label>
            <input type="text" required value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-4 py-3 rounded-xl input-premium" placeholder="Ex: Compras" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-foreground mb-1">Valor</label>
                <input type="number" step="0.01" required value={valor} onChange={(e) => setValor(e.target.value)} className="w-full px-4 py-3 rounded-xl input-premium" placeholder="0.00" />
            </div>
            <div>
                <label className="block text-sm font-medium text-foreground mb-1">Categoria</label>
                <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="w-full px-4 py-3 rounded-xl input-premium">
                    <option value="">Selecione...</option>
                    {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
            </div>
          </div>

                    {/* NOVO CAMPO: Escolher Cartão */}
          {tipo === 'despesa' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Pagar com Cartão (Opcional)</label>
                <select value={cartaoId} onChange={(e) => { setCartaoId(e.target.value); if (!e.target.value) setParcelas('1'); }} className="w-full px-4 py-3 rounded-xl input-premium">
                  <option value="">Dinheiro / Débito</option>
                  {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              {cartaoId && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Parcelas</label>
                  <select value={parcelas} onChange={(e) => setParcelas(e.target.value)} className="w-full px-4 py-3 rounded-xl input-premium">
                    <option value="1">1x (À vista)</option>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map(n => (
                      <option key={n} value={n}>{n}x</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={loading} className={`btn-premium w-full py-3.5 mt-2 text-white rounded-xl font-bold shadow-minimal ${tipo === 'receita' ? 'bg-green-600' : 'bg-red-600'}`}>
            {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Salvar Transação'}
          </button>
        </form>
      </div>
    </div>
  )
}