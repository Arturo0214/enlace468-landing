import { usePlan } from '../../lib/planContext'

const PLAN_STYLES = {
  enterprise: {
    bg: 'from-blue-500/20 to-blue-600/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  recruiter: {
    bg: 'from-teal-500/20 to-teal-600/10',
    text: 'text-teal-400',
    border: 'border-teal-500/20',
  },
  academy: {
    bg: 'from-purple-500/20 to-purple-600/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
  },
  talent_desk: {
    bg: 'from-amber-500/20 to-amber-600/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  tu_marca_vende: {
    bg: 'from-green-500/20 to-green-600/10',
    text: 'text-green-400',
    border: 'border-green-500/20',
  },
}

const FREE_STYLE = {
  bg: 'from-gray-500/20 to-gray-600/10',
  text: 'text-gray-400',
  border: 'border-gray-500/20',
}

function getStyle(slug) {
  if (!slug) return FREE_STYLE
  for (const key of Object.keys(PLAN_STYLES)) {
    if (slug.startsWith(key)) return PLAN_STYLES[key]
  }
  return FREE_STYLE
}

export default function PlanBadge() {
  const { currentPlan, loading } = usePlan()

  if (loading) return null

  const style = getStyle(currentPlan?.slug)
  const label = currentPlan?.name ?? 'Free'

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-gradient-to-r ${style.bg} ${style.text} ${style.border}`}
    >
      {label}
    </span>
  )
}
