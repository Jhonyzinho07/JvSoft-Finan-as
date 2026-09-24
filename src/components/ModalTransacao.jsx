import { useState, useEffect } from 'react'
import { moedaParaNumero } from '../utils/moeda'
import CampoMoeda from './CampoMoeda'
import ModalOverlay from './ModalOverlay'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { hojeISO } from '../utils/helpers'

export default function ModalTransacao({ onClose, tipoInicial = 'despesa' }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [tipo, setTipo] = useState(tipoInicial)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hojeISO())
  const [categoriaId, setCategoriaId] = useState('')
  const [cartaoId, setCartaoId] = useState('')
  const [parcelas, setParcelas] = useState('1')
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

    const valorNumerico = moedaParaNumero(valor)
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      toast.warning('Digite um valor válido.')
      return
    }

    setLoading(true)
    try {
      if (tipo === 'despesa' && cartaoId) {
        // Tudo em uma única transação no banco: fatura(s) + parcela(s)
        const { error } = await supabase.rpc('lancar_gasto_cartao', {
          p_cartao_id: cartaoId,
          p_valor: valorNumerico,
          p_parcelas: parseInt(parcelas) || 1,
          p_descricao: descricao,
          p_data: data,
          p_categoria_id: categoriaId || null,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.from('transacoes').insert([{
          tipo,
          descricao,
          valor: valorNumerico,
          data_transacao: data,
          categoria_id: categoriaId || null,
        }])
        if (error) throw error
      }

      toast.success('Transação salva!')
      // As páginas abertas se atualizam pelo Realtime; o cache do React Query é invalidado aqui
      queryClient.invalidateQueries()
      onClose()
    } catch (error) {
      console.error('Erro ao salvar transação:', error)
      toast.error('Não foi possível salvar a transação. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalOverlay>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden dark:bg-slate-800">
        <div className={`bg-gradient-to-r ${tipo === 'receita' ? 'from-green-600 to-emerald-400' : 'from-red-600 to-rose-400'} px-6 py-4 flex items-center justify-between text-white`}>
          <h2 className="font-bold text-lg flex items-center gap-2">Nova Transação</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-2.5 -mr-1.5 hover:bg-white/20 rounded-full"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button type="button" onClick={() => setTipo('despesa')} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg ${tipo === 'despesa' ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Despesa</button>
            <button type="button" onClick={() => setTipo('receita')} className={`flex-1 py-2.5 text-sm font-semibold rounded-lg ${tipo === 'receita' ? 'bg-white dark:bg-slate-700 text-green-600 dark:text-green-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Receita</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Descrição</label>
            <input type="text" required value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="Ex: Compras" />
          </div>

          <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Valor</label>
                <CampoMoeda required value={valor} onChange={setValor} />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Categoria</label>
                <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white dark:border-slate-700 dark:bg-slate-800">
                    <option value="">Selecione...</option>
                    {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">{tipo === 'despesa' && cartaoId ? 'Data da compra' : 'Data'}</label>
            <input type="date" required value={data} onChange={(e) => setData(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </div>

          {/* Pagar com cartão: a compra entra na(s) fatura(s) do cartão */}
          {tipo === 'despesa' && (
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Pagar com Cartão (Opcional)</label>
                <select value={cartaoId} onChange={(e) => { setCartaoId(e.target.value); if (!e.target.value) setParcelas('1'); }} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white dark:border-slate-700 dark:bg-slate-800">
                  <option value="">Dinheiro / Débito</option>
                  {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              {cartaoId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Parcelas</label>
                  <select value={parcelas} onChange={(e) => setParcelas(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white dark:border-slate-700 dark:bg-slate-800">
                    <option value="1">1x (À vista)</option>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map(n => (
                      <option key={n} value={n}>{n}x</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={loading} className={`w-full py-3.5 mt-2 text-white rounded-xl font-bold shadow-lg ${tipo === 'receita' ? 'bg-green-600' : 'bg-red-600'}`}>
            {loading ? <Loader2 className="animate-spin mx-auto"/> : 'Salvar Transação'}
          </button>
        </form>
      </div>
    </ModalOverlay>
  )
}