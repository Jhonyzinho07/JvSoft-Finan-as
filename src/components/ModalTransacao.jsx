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


      if (tipo === 'despesa' && cartaoId) {
        const cartaoSelecionado = cartoes.find(c => c.id === cartaoId)
        let transacoesInserir = []
        let dataBase = new Date(data + 'T12:00:00')

        for (let i = 0; i < numParcelas; i++) {
          let valorFatura = numParcelas > 1 ? parseFloat((valorNumerico / numParcelas).toFixed(2)) : valorNumerico
          let descricaoTx = numParcelas > 1 ? `${descricao} - Parcela ${i + 1}/${numParcelas}` : descricao

          let dataVencimentoFatura = new Date(dataBase)
          dataVencimentoFatura.setMonth(dataBase.getMonth() + i)

          // Lógica de fechamento (pode não estar perfeito se ModalTransacao não trouxer dia_fechamento, mas usa o que tem)
          if (cartaoSelecionado && cartaoSelecionado.dia_vencimento) {
            let mesAjuste = dataBase.getMonth() + i
            // Simplificado: Assumindo fechamento 7 dias antes do vencimento se não disponível no payload atual do modal
            let diaFechamento = cartaoSelecionado.dia_fechamento || (cartaoSelecionado.dia_vencimento - 7);
            if (diaFechamento < 1) diaFechamento = 1;

            if (i === 0 && dataBase.getDate() >= diaFechamento) {
              mesAjuste += 1
            }
            dataVencimentoFatura = new Date(dataBase.getFullYear(), mesAjuste, cartaoSelecionado.dia_vencimento)
          }

          const dataVencString = dataVencimentoFatura.toISOString().split('T')[0]
          const mesAno = `${String(dataVencimentoFatura.getMonth() + 1).padStart(2, '0')}/${dataVencimentoFatura.getFullYear()}`
          const descricaoFatura = `Fatura: ${cartaoSelecionado?.nome || 'Cartão'}`

          let { data: faturas } = await supabase
            .from('contas')
            .select('id, valor, data_vencimento')
            .eq('descricao', descricaoFatura)
            .eq('status_pago', false)

          let faturaId = null

          let faturaExistente = faturas?.find(f => {
             if(!f.data_vencimento) return false;
             const dv = new Date(f.data_vencimento + 'T12:00:00');
             return dv.getMonth() === dataVencimentoFatura.getMonth() && dv.getFullYear() === dataVencimentoFatura.getFullYear();
          });

          if (faturaExistente) {
            const novoValor = Number(faturaExistente.valor) + valorFatura;
            await supabase.from('contas').update({ valor: novoValor }).eq('id', faturaExistente.id);
            faturaId = faturaExistente.id;
          } else {
            const { data: novaFatura, error: errFatura } = await supabase.from('contas').insert([{
              descricao: descricaoFatura,
              valor: valorFatura,
              data_vencimento: dataVencString,
              status_pago: false,
              categoria_id: categoriaId || null,
              mes_referencia: mesAno
            }]).select().single();
            if (!errFatura && novaFatura) {
               faturaId = novaFatura.id;
            }
          }

          transacoesInserir.push({
            tipo,
            descricao: descricaoTx,
            valor: valorFatura,
            data_transacao: numParcelas > 1 ? dataVencString : data,
            categoria_id: categoriaId || null,
            cartao_id: cartaoId,
            conta_consumo_id: faturaId // Link
          })
        }
        const { error: errTrans } = await supabase.from('transacoes').insert(transacoesInserir)
        if (errTrans) throw errTrans

      } else {
        // Fluxo normal (sem cartão)
        const { error: errTrans } = await supabase.from('transacoes').insert([{
          tipo,
          descricao,
          valor: valorNumerico,
          data_transacao: data,
          categoria_id: categoriaId || null,
          conta_id: null // Ignorado cartão
        }])

        if (errTrans) throw errTrans
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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden dark:bg-slate-800">
        <div className={`bg-gradient-to-r ${tipo === 'receita' ? 'from-green-600 to-emerald-400' : 'from-red-600 to-rose-400'} px-6 py-4 flex items-center justify-between text-white`}>
          <h2 className="font-bold text-lg flex items-center gap-2">Nova Transação</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button type="button" onClick={() => setTipo('despesa')} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${tipo === 'despesa' ? 'bg-white dark:bg-slate-700 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Despesa</button>
            <button type="button" onClick={() => setTipo('receita')} className={`flex-1 py-2 text-sm font-semibold rounded-lg ${tipo === 'receita' ? 'bg-white dark:bg-slate-700 text-green-600 dark:text-green-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>Receita</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Descrição</label>
            <input type="text" required value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="Ex: Compras" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Valor</label>
                <input type="number" step="0.01" required value={valor} onChange={(e) => setValor(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="0.00" />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-200">Categoria</label>
                <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none bg-white dark:border-slate-700 dark:bg-slate-800">
                    <option value="">Selecione...</option>
                    {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
            </div>
          </div>

                    {/* NOVO CAMPO: Escolher Cartão */}
          {tipo === 'despesa' && (
            <div className="grid grid-cols-2 gap-4">
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
    </div>
  )
}