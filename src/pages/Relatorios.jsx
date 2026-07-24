import { useState, useEffect, useRef } from 'react'
import { BarChart2, TrendingUp, TrendingDown, DollarSign, Loader2, Calendar, FileText, Filter, X } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase } from '../supabaseClient'
import { formatarMoeda } from '../utils/helpers'
import { useToast } from '../components/Toast'
// jsPDF, autoTable e html2canvas são carregados só quando o usuário clica em "Exportar PDF"
// (import dinâmico — mantém o chunk de Relatorios leve no carregamento inicial)

export default function Relatorios() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [gerandoPDF, setGerandoPDF] = useState(false)
  
  const [dadosBrutos, setDadosBrutos] = useState([])
  
  const [filtroMes, setFiltroMes] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })

  const [resumo, setResumo] = useState({ receitas: 0, despesas: 0, saldo: 0 })
  const [dadosGraficoPizza, setDadosGraficoPizza] = useState([])
  const [dadosGraficoBarras, setDadosGraficoBarras] = useState([])
  const [transacoesPDF, setTransacoesPDF] = useState([])

  const graficoBarrasRef = useRef(null)
  const graficoPizzaRef = useRef(null)

  const carregarDados = async () => {
    setLoading(true)
    try {
      const { data: manuais } = await supabase.from('transacoes').select('*, categorias(nome)')
      const { data: receitas } = await supabase.from('receitas').select('*')
      const { data: contas } = await supabase.from('contas').select('*, credores(nome), categorias(nome)').is('status_pago', false)

      const historicoUnificado = []

      manuais?.forEach(m => historicoUnificado.push({
        tipo: m.tipo,
        descricao: m.descricao,
        valor: Number(m.valor),
        data: m.data_transacao || m.criado_em,
        categoria: m.categorias?.nome || 'Geral'
      }))
      
      receitas?.forEach(r => historicoUnificado.push({
        tipo: 'receita',
        descricao: r.descricao,
        valor: Number(r.valor),
        data: r.criado_em,
        categoria: 'Receita Fixa'
      }))

      contas?.forEach(c => historicoUnificado.push({
        tipo: 'despesa',
        descricao: c.descricao,
        valor: Number(c.valor),
        data: c.criado_em,
        categoria: c.categorias?.nome || c.credores?.nome || 'Consumo'
      }))

      setDadosBrutos(historicoUnificado)
    } catch (error) {
      console.error("Erro ao carregar relatórios:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (dadosBrutos.length === 0) return

    let historicoFiltrado = dadosBrutos
    
    if (filtroMes) {
      const [anoFiltro, mesFiltro] = filtroMes.split('-')
      historicoFiltrado = dadosBrutos.filter(t => {
        if (!t.data) return false
        const d = t.data.includes('T') ? new Date(t.data) : new Date(t.data + 'T12:00:00')
        return d.getFullYear() === parseInt(anoFiltro) && (d.getMonth() + 1) === parseInt(mesFiltro)
      })
    }

    setTransacoesPDF(historicoFiltrado)

    let totalReceitas = 0
    let totalDespesas = 0

    historicoFiltrado.forEach(t => {
      if (t.tipo === 'receita') totalReceitas += t.valor
      if (t.tipo === 'despesa') totalDespesas += t.valor
    })

    setResumo({
      receitas: totalReceitas,
      despesas: totalDespesas,
      saldo: totalReceitas - totalDespesas
    })

    const despesasAgrupadas = {}
    historicoFiltrado.filter(t => t.tipo === 'despesa').forEach(d => {
      despesasAgrupadas[d.categoria] = (despesasAgrupadas[d.categoria] || 0) + d.valor
    })

    const cores = ['#1e40af', '#0891b2', '#059669', '#7c3aed', '#dc2626', '#d97706', '#ec4899', '#f97316']
    const pizzaData = Object.keys(despesasAgrupadas)
      .sort((a, b) => despesasAgrupadas[b] - despesasAgrupadas[a])
      .map((key, index) => ({
        name: key,
        value: despesasAgrupadas[key],
        color: cores[index % cores.length]
      }))
    
    setDadosGraficoPizza(pizzaData)

    const mesesAgrupados = {}
    const nomeMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    dadosBrutos.forEach(t => {
      if (!t.data) return
      const dateObj = t.data.includes('T') ? new Date(t.data) : new Date(t.data + 'T12:00:00')
      const mesAno = `${nomeMeses[dateObj.getMonth()]}/${dateObj.getFullYear()}`

      if (!mesesAgrupados[mesAno]) {
        mesesAgrupados[mesAno] = { mes: mesAno, Receitas: 0, Despesas: 0, timestamp: dateObj.getTime() }
      }

      if (t.tipo === 'receita') mesesAgrupados[mesAno].Receitas += t.valor
      if (t.tipo === 'despesa') mesesAgrupados[mesAno].Despesas += t.valor
    })

    const barrasData = Object.values(mesesAgrupados)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-12) 
      
    setDadosGraficoBarras(barrasData)

  }, [dadosBrutos, filtroMes])

  useEffect(() => {
    carregarDados()
  }, [])


  const exportarPDF = async () => {
    setGerandoPDF(true)
    
    // Aumentado um pouco o tempo para o React re-renderizar sem o truncate e com espaço
    await new Promise(resolve => setTimeout(resolve, 800))
    
    try {
      // Carrega as libs pesadas de PDF só neste momento (não no carregamento da página)
      const [{ default: jsPDF }, { default: autoTable }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
        import('html2canvas'),
      ])

      const doc = new jsPDF()
      const dataAtual = new Date().toLocaleDateString('pt-BR')

      let periodoTexto = 'Período: Todo o Histórico'
      if (filtroMes) {
        const [ano, mes] = filtroMes.split('-')
        periodoTexto = `Período: ${mes}/${ano}`
      }

      const desenharCabecalho = (doc, numeroPagina) => {
        try {
          doc.addImage('/logo.png', 'PNG', 14, 10, 16, 16)
        } catch (e) {
          console.warn("Logo não encontrada.")
        }
        
        doc.setFontSize(22)
        doc.setTextColor(30, 58, 138)
        doc.text("JvSoft Finanças", 34, 20) 

        doc.setFontSize(10)
        doc.setTextColor(100)
        doc.text(`Relatório Executivo Analítico | Página ${numeroPagina}`, 14, 34)
        doc.text(`${periodoTexto}  •  Gerado em: ${dataAtual}`, 14, 40)
        
        doc.setDrawColor(226, 232, 240)
        doc.line(14, 44, 196, 44)
      }

      desenharCabecalho(doc, 1)

      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.setTextColor(51, 65, 85)
      doc.text("Resumo do Período", 14, 52)

      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      
      doc.setTextColor(22, 163, 74)
      doc.text(`Entradas: ${formatarMoeda(resumo.receitas)}`, 14, 60)
      
      doc.setTextColor(220, 38, 38) 
      doc.text(`Saídas: ${formatarMoeda(resumo.despesas)}`, 75, 60)
      
      doc.setTextColor(resumo.saldo >= 0 ? 22 : 220, resumo.saldo >= 0 ? 163 : 38, resumo.saldo >= 0 ? 74 : 38) 
      doc.setFont(undefined, 'bold')
      doc.text(`Saldo Geral: ${formatarMoeda(resumo.saldo)}`, 140, 60)
      doc.setFont(undefined, 'normal') 

      let startYTabela = 70 

      if (graficoBarrasRef.current && graficoPizzaRef.current && dadosGraficoBarras.length > 0) {
        doc.setFontSize(11)
        doc.setTextColor(51, 65, 85)
        doc.setFont(undefined, 'bold')
        doc.text("Evolução Mensal", 14, 75)
        doc.text("Despesas por Categoria", 110, 75)

        // Adicionado configurações extras para garantir a captura perfeita
        const options = { 
          scale: 2, 
          backgroundColor: '#ffffff', 
          logging: false,
          scrollY: 0 // Evita bugs se a tela estiver rolada
        }

        const canvasBarras = await html2canvas(graficoBarrasRef.current, options)
        const imgBarras = canvasBarras.toDataURL('image/png')
        const barraRatio = canvasBarras.width / canvasBarras.height
        const alturaBarrasFinal = 85 / barraRatio
        doc.addImage(imgBarras, 'PNG', 14, 80, 85, alturaBarrasFinal)

        const canvasPizza = await html2canvas(graficoPizzaRef.current, options)
        const imgPizza = canvasPizza.toDataURL('image/png')
        const pizzaRatio = canvasPizza.width / canvasPizza.height
        const alturaPizzaFinal = 85 / pizzaRatio
        doc.addImage(imgPizza, 'PNG', 110, 80, 85, alturaPizzaFinal)
        
        startYTabela = 80 + Math.max(alturaBarrasFinal, alturaPizzaFinal) + 15 
      }

      const tableColumn = ["Data", "Descrição", "Categoria", "Tipo", "Valor"]
      const tableRows = []

      const transacoesOrdenadas = [...transacoesPDF].sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))

      transacoesOrdenadas.forEach(t => {
        const dateObj = t.data ? (t.data.includes('T') ? new Date(t.data) : new Date(t.data + 'T12:00:00')) : null
        const dataFormatada = dateObj ? dateObj.toLocaleDateString('pt-BR') : '--/--/----'

        const transacaoData = [
          dataFormatada,
          t.descricao || 'Sem descrição',
          t.categoria,
          t.tipo === 'receita' ? 'Entrada' : 'Saída',
          formatarMoeda(t.valor)
        ]
        tableRows.push(transacaoData)
      })

      autoTable(doc, {
        startY: startYTabela,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [14, 165, 233], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9, cellPadding: 4 },
        margin: { top: 50 }, 
        didDrawPage: function(data) {
          if (data.pageNumber > 1) {
            desenharCabecalho(doc, data.pageNumber)
          }
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 4) {
            const tipo = transacoesOrdenadas[data.row.index].tipo
            data.cell.styles.textColor = tipo === 'receita' ? [22, 163, 74] : [220, 38, 38]
            data.cell.styles.fontStyle = 'bold'
          }
        }
      })

      doc.save(`JvSoft_Relatorio_${dataAtual.replace(/\//g, '-')}.pdf`)
      
    } catch (error) {
      console.error("Erro completo ao gerar PDF:", error)
      toast.error('Erro ao gerar o PDF. Tente novamente.')
    } finally {
      setGerandoPDF(false)
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
          <p className="font-bold text-slate-800 mb-2 dark:text-slate-100">{label || payload[0].name}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm font-semibold">
              {entry.name}: {formatarMoeda(entry.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto animate-fade-in pb-24">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3 dark:text-slate-100">
            <BarChart2 className="text-blue-600" size={32} />
            Relatórios
          </h1>
          <p className="text-slate-500 mt-2 dark:text-slate-400">Análise detalhada da sua saúde financeira</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl shadow-soft border border-slate-100 w-full sm:w-auto dark:bg-slate-800 dark:border-slate-700">
            <Filter size={18} className="text-blue-600" />
            <input 
              type="month" 
              value={filtroMes} 
              onChange={(e) => setFiltroMes(e.target.value)}
              className="bg-transparent outline-none text-slate-700 font-medium cursor-pointer w-full dark:text-slate-200"
            />
            {filtroMes && (
              <button onClick={() => setFiltroMes('')} className="text-slate-400 hover:text-red-500 transition-colors" title="Ver todo o histórico">
                <X size={18} />
              </button>
            )}
          </div>

          <button 
            onClick={exportarPDF} 
            disabled={loading || transacoesPDF.length === 0 || gerandoPDF}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-900 to-cyan-500 text-white rounded-xl shadow-lg hover:shadow-cyan-500/30 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {gerandoPDF ? (
              <><Loader2 size={18} className="animate-spin" /> Gerando...</>
            ) : (
              <><FileText size={18} /> Baixar PDF</>
            )}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
          Gerando gráficos e análises...
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 flex items-center gap-4 dark:bg-slate-800 dark:border-slate-700">
              <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center">
                <TrendingUp size={28} />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium dark:text-slate-400">Total de Entradas</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatarMoeda(resumo.receitas)}</p>
              </div>
            </div>
            
            <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 flex items-center gap-4 dark:bg-slate-800 dark:border-slate-700">
              <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                <TrendingDown size={28} />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium dark:text-slate-400">Total de Saídas</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatarMoeda(resumo.despesas)}</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-900 to-cyan-500 rounded-3xl p-6 shadow-lg shadow-blue-500/20 flex items-center gap-4 text-white">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
                <DollarSign size={28} />
              </div>
              <div>
                <p className="text-sm text-blue-100 font-medium">Balanço Geral</p>
                <p className="text-2xl font-bold">{formatarMoeda(resumo.saldo)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="text-blue-600" size={20} />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Evolução Mensal</h3>
              </div>
              
              {/* CORREÇÃO 1: Adicionado pb-8 para o html2canvas ter margem extra de segurança na captura */}
              <div ref={graficoBarrasRef} className="bg-white px-2 pt-2 pb-8 dark:bg-slate-800">
                {dadosGraficoBarras.length > 0 ? (
                  <div className="h-72 sm:h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dadosGraficoBarras} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `R$ ${value}`} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                        <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar isAnimationActive={false} dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar isAnimationActive={false} dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 sm:h-80 flex items-center justify-center text-slate-400">Dados insuficientes para gerar o gráfico.</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-soft border border-slate-100 dark:bg-slate-800 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-6">
                <PieChart className="text-blue-600" size={20} />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Despesas por Categoria</h3>
              </div>
              
              {/* CORREÇÃO 1: Adicionado pb-8 para dar folga na base da imagem */}
              <div ref={graficoPizzaRef} className="bg-white px-2 pt-2 pb-8 dark:bg-slate-800">
                {dadosGraficoPizza.length > 0 ? (
                  <div className="flex flex-col">
                    
                    <div className="h-56 sm:h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            isAnimationActive={false}
                            data={dadosGraficoPizza}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {dadosGraficoPizza.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    {/* CORREÇÃO 2: A legenda também ganha espaço e as palavras longas não serão cortadas! */}
                    <div className={`mt-4 grid grid-cols-2 gap-x-2 gap-y-4 pr-2 ${gerandoPDF ? 'pb-4' : 'overflow-y-auto max-h-32 custom-scrollbar'}`}>
                      {dadosGraficoPizza.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                          {/* CORREÇÃO 3: Quando gerar o PDF, o 'truncate' sai de cena para não cortar as letras */}
                          <span className={`text-xs text-slate-600 flex-1 ${gerandoPDF ? 'whitespace-normal' : 'truncate'}`} title={item.name}>{item.name}</span>
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{formatarMoeda(item.value)}</span>
                        </div>
                      ))}
                    </div>

                  </div>
                ) : (
                  <div className="h-72 sm:h-80 flex items-center justify-center text-slate-400">Nenhuma despesa registrada.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}