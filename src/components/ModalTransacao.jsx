import { useState, useEffect } from 'react'
import { X, TrendingUp, TrendingDown, DollarSign, Type, Loader2, Calendar, Tag, CreditCard } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useToast } from '../components/Toast'

export default function ModalTransacao({ onClose, tipoInicial = 'despesa' }) {
  const toast = useToast()
  const [tipo, setTipo] = useState(tipoInicial)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [categoriaId, setCategoriaId] = useState('')
  const [cartaoId, setCartaoId] = useState('')
  const [categorias, setCategorias] = useState([])
  const [cartoes, setCartoes] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function carregarDados() {
      const { data: catData } = await supabase.from('categorias').select('id, nome, tipo')
      const { data: cartData } = await supabase.from('cartoes').select('id, nome')
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
      
      // 1. Inserir a Transação (Se tiver cartão_id, ela é registrada mas não é "dinheiro vivo")
      const { data: transacao, error: errTrans } = await supabase.from('transacoes').insert([{
        tipo,
        descricao,
        valor: valorNumerico,
        data_transacao: data,
        categoria_id: categoriaId || null,
        cartao_id: cartaoId || null // Se for null, sai do saldo. Se tiver ID, vai pro cartão.
      }]).select()

      if (errTrans) throw errTrans

      // 2. Se for despesa no cartão, atualiza a fatura do cartão automaticamente
      if (tipo === 'despesa' && cartaoId) {
        const cartao = cartoes.find(c => c.id === cartaoId)
        // Precisamos buscar o valor atual da fatura antes de somar
        const { data: cartaoAtual } = await supabase.from('cartoes').select('fatura_atual').eq('id', cartaoId).single()
        
        await supabase.from('cartoes')
          .update({ fatura_atual: Number(cartaoAtual.fatura_atual) + valorNumerico })
          .eq('id', cartaoId)
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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className={`bg-gradient-to-r ${tipo === 'receita' ? 'from-green-600 to-emerald-400' : 'from-red-600 to-rose-400'} px-6 py-4 flex items-center justify-between text-white`}>
          <h2 className="font-bold text-lg flex items-center gap-2">Nova Transação</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button type="button" onClick={() => setTipo('despesa')} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${tipo === 'despesa' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}>Despesa</button>
            <button type="button" onClick={() => setTipo('receita')} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${tipo === 'receita' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500'}`}>Receita</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input type="text" required value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" placeholder="Ex: Compras" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Valor</label>
                <input type="number" step="0.01" required value={valor} onChange={(e) => setValor(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none" placeholder="0.00" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white">
                    <option value="">Selecione...</option>
                    {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
            </div>
          </div>

          {/* NOVO CAMPO: Escolher Cartão */}
          {tipo === 'despesa' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pagar com Cartão (Opcional)</label>
              <select value={cartaoId} onChange={(e) => setCartaoId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white">
                <option value="">Dinheiro / Débito (Sai do Saldo)</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}

          <button type="submit" disabled={loading} className={`w-full py-3.5 mt-2 text-white rounded-xl font-bold shadow-lg ${tipo === 'receita' ? 'bg-green-600' : 'bg-red-600'}`}>
            {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Salvar Transação'}
          </button>
        </form>
      </div>
    </div>
  )
}