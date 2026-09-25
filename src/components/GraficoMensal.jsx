import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatarMoeda } from '../utils/helpers'

// Gráfico de barras do Dashboard (receitas x despesas, últimos 6 meses).
// Fica num arquivo próprio para ser carregado com React.lazy — o recharts
// sozinho pesa ~100 KB gzip e não precisa atrasar o resto do Dashboard.
export default function GraficoMensal({ grafico, isDark }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={190}>
        <BarChart data={grafico} barSize={9} barGap={2}>
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: isDark ? '#64748b' : '#94a3b8' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            formatter={(v, name) => [formatarMoeda(v), name === 'receitas' ? 'Receitas' : 'Despesas']}
            contentStyle={{
              borderRadius: 12,
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#f1f5f9' : '#1e293b',
              fontSize: 11
            }}
            cursor={{ fill: isDark ? '#334155' : '#f8fafc' }}
          />
          <Bar dataKey="receitas" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="despesas" fill="#f87171" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-5 mt-2">
        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Receitas
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Despesas
        </span>
      </div>
    </>
  )
}
