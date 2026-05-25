import { Shield, Lock, FileCheck } from 'lucide-react'

const variants = {
  ai_suggestion: {
    icon: Shield,
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/10',
    iconColor: 'text-amber-400',
    textColor: 'text-amber-200',
  },
  confidential: {
    icon: Lock,
    border: 'border-l-red-500',
    bg: 'bg-red-500/10',
    iconColor: 'text-red-400',
    textColor: 'text-red-200',
  },
  consent: {
    icon: FileCheck,
    border: 'border-l-blue-500',
    bg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    textColor: 'text-blue-200',
  },
}

export default function ComplianceBanner({ type = 'ai_suggestion', children }) {
  const v = variants[type] || variants.ai_suggestion
  const Icon = v.icon

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border-l-4 ${v.border} ${v.bg}`}>
      <Icon size={18} className={`${v.iconColor} flex-shrink-0 mt-0.5`} />
      <span className={`text-sm ${v.textColor}`}>{children}</span>
    </div>
  )
}
