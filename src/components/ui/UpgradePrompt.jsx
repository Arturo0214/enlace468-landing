import { Lock } from 'lucide-react'

const ACTION_DESCRIPTIONS = {
  create_vacancy: 'Crear vacantes adicionales requiere un plan con mayor capacidad.',
  access_candidate_bank: 'El banco de candidatos esta disponible en planes Enterprise Growth+ o Recruiter Pro+.',
  use_screening: 'El screening automatizado esta disponible en planes Enterprise Starter+ o Recruiter Pro.',
  use_outreach: 'El outreach esta disponible en planes Recruiter Pro+ o Talent Desk Pro.',
  view_reports: 'Los reportes avanzados estan disponibles en planes Enterprise Growth+ o Talent Desk Pro.',
  use_ai_prompts: 'Los prompts de IA estan disponibles en planes Recruiter Basic+ o Academy Founder+.',
}

export default function UpgradePrompt({ action }) {
  const description =
    ACTION_DESCRIPTIONS[action] ||
    'Esta funcion requiere un plan superior.'

  return (
    <div className="relative overflow-hidden rounded-2xl p-8 text-center max-w-md mx-auto"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Decorative gradient accent */}
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-30 blur-2xl pointer-events-none"
        style={{ background: 'linear-gradient(135deg, #6366f1, #06b6d4)' }}
      />

      <div className="relative z-10 flex flex-col items-center gap-4">
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.2))',
          }}
        >
          <Lock size={24} className="text-indigo-400" />
        </div>

        <h3 className="text-lg font-display font-semibold text-white">
          Funcion no disponible en tu plan actual
        </h3>

        <p className="text-sm text-gray-400 leading-relaxed">
          {description}
        </p>

        <a
          href="/#precios"
          className="mt-2 inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
          }}
        >
          Ver planes
        </a>
      </div>
    </div>
  )
}
