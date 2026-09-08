import { motion } from 'framer-motion'

const defaultColors = [
  'from-blue-500 to-blue-400',
  'from-cyan-500 to-cyan-400',
  'from-emerald-500 to-emerald-400',
  'from-amber-500 to-amber-400',
  'from-green-500 to-green-400',
]

export default function CampaignFunnel({ data = [] }) {
  if (!data.length) return null

  const max = Math.max(...data.map(d => d.count), 1)

  return (
    <div className="space-y-3">
      {data.map((item, i) => {
        const pct = (item.count / max) * 100
        const conversionRate = i > 0 && data[i - 1].count > 0
          ? ((item.count / data[i - 1].count) * 100).toFixed(0)
          : null

        return (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-ink-secondary">{item.label}</span>
              <div className="flex items-center gap-2">
                {conversionRate && (
                  <span className="text-[10px] text-ink-tertiary">{conversionRate}%</span>
                )}
                <span className="text-xs font-semibold text-ink">{item.count}</span>
              </div>
            </div>
            <div className="w-full h-7 rounded-lg bg-surface-1 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct, 2)}%` }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: 'easeOut' }}
                className={`h-full rounded-lg bg-gradient-to-r ${item.color || defaultColors[i % defaultColors.length]} flex items-center justify-end pr-2`}
              >
                {pct > 15 && (
                  <span className="text-[10px] font-semibold text-white/80">{item.count}</span>
                )}
              </motion.div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
