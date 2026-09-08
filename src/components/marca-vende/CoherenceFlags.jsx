import { AlertTriangle, ShieldCheck } from 'lucide-react'

// Panel de banderas de honestidad/coherencia del motor.
// Las flags se muestran para REVISION HUMANA antes de exportar/publicar.
const SEVERITY_STYLES = {
  alta: { dot: '#ef4444', label: 'Alta', text: 'text-red-300' },
  media: { dot: '#f59e0b', label: 'Media', text: 'text-amber-300' },
  baja: { dot: '#22d3ee', label: 'Baja', text: 'text-cyan-300' },
}

const TIPO_LABEL = {
  seniority: 'Seniority',
  'años': 'Años de experiencia',
  anos: 'Años de experiencia',
  claim: 'Cifra sin evidencia',
  titulo: 'Título / credencial',
}

export default function CoherenceFlags({ flags = [] }) {
  if (!Array.isArray(flags) || flags.length === 0) {
    return (
      <div className="glass rounded-xl p-5 flex items-center gap-3">
        <ShieldCheck size={20} className="text-accent shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-ink">Checkpoint de honestidad: sin alertas</h3>
          <p className="text-xs text-ink-secondary mt-0.5">El motor no detectó seniority inflado, años inconsistentes ni cifras sin respaldo.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-xl p-5 border" style={{ borderColor: 'rgba(245,158,11,0.25)' }}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={18} className="text-amber-400" />
        <h3 className="text-sm font-semibold text-ink">
          Revisa antes de publicar — {flags.length} {flags.length === 1 ? 'alerta' : 'alertas'} de honestidad
        </h3>
      </div>
      <p className="text-xs text-ink-secondary mb-4">
        Estas alertas no se aplican solas. Confírmalas o ajústalas tú: el motor nunca inventa datos.
      </p>
      <ul className="space-y-3">
        {flags.map((f, i) => {
          const sev = SEVERITY_STYLES[f.severidad] || SEVERITY_STYLES.media
          return (
            <li key={i} className="flex gap-3">
              <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: sev.dot }} />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-gray-200">{TIPO_LABEL[f.tipo] || f.tipo}</span>
                  <span className={`text-[10px] uppercase tracking-wide ${sev.text}`}>{sev.label}</span>
                </div>
                <p className="text-sm text-ink-secondary leading-relaxed">{f.mensaje}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
