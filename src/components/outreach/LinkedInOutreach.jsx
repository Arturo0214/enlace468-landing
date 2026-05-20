import { useState } from 'react'
import { Send, Copy, ChevronDown, ChevronUp, Sparkles, Users, MessageSquare, Clock, CheckCircle } from 'lucide-react'

const defaultTemplates = [
  {
    id: 'connection',
    name: 'Solicitud de conexion',
    stage: 'Invitacion',
    subject: '',
    body: `Hola {{nombre}},

Vi tu perfil y me parece muy interesante tu experiencia en {{industria}}. En Enlace 468 estamos buscando un {{puesto}} y creo que tu trayectoria en {{empresa_actual}} podria ser un gran fit.

Me encantaria conectar contigo. ¿Te gustaria platicar?

Saludos,
{{reclutador}}
Enlace 468`,
  },
  {
    id: 'followup_1',
    name: 'Seguimiento 1 (3 dias)',
    stage: 'Primer seguimiento',
    subject: '',
    body: `Hola {{nombre}}, ¿como estas?

Te escribi hace unos dias sobre una oportunidad como {{puesto}} en Finance S-Cool. Me encantaria poder platicarte mas al respecto.

¿Tienes 15 minutos esta semana para una llamada rapida?

Quedo al pendiente,
{{reclutador}}`,
  },
  {
    id: 'followup_2',
    name: 'Seguimiento 2 (7 dias)',
    stage: 'Segundo seguimiento',
    subject: '',
    body: `Hola {{nombre}},

Entiendo que estas ocupado/a. Solo queria confirmar si la oportunidad de {{puesto}} te interesa o no, para no seguir molestando.

Si no es el momento, sin problema. Si conoces a alguien que pueda estar interesado, te agradeceria mucho la referencia.

Un abrazo,
{{reclutador}}`,
  },
  {
    id: 'interest',
    name: 'Respuesta positiva',
    stage: 'Interes confirmado',
    subject: '',
    body: `Excelente {{nombre}}, me da mucho gusto tu interes!

Te comparto los detalles clave:
• Puesto: {{puesto}}
• Empresa: Finance S-Cool
• Ubicacion: {{ubicacion}}
• Rango salarial: {{salario}}

¿Te parece si agendamos una videollamada? Te mando mi link de calendario: [LINK]

Saludos,
{{reclutador}}`,
  },
  {
    id: 'rejection_polite',
    name: 'Cierre - No seleccionado',
    stage: 'Cierre',
    subject: '',
    body: `Hola {{nombre}},

Muchas gracias por tu tiempo e interes en la posicion de {{puesto}}. Fue un gusto conocer tu trayectoria.

En esta ocasion avanzamos con otro perfil, pero tu experiencia es muy valiosa y me gustaria mantener el contacto para futuras oportunidades.

¿Te parece si nos mantenemos conectados?

Un abrazo,
{{reclutador}}`,
  },
]

const sequenceSteps = [
  { day: 0, template: 'connection', label: 'Dia 0 - Invitacion', color: 'bg-accent/20 text-accent' },
  { day: 3, template: 'followup_1', label: 'Dia 3 - Seguimiento 1', color: 'bg-gold/20 text-gold' },
  { day: 7, template: 'followup_2', label: 'Dia 7 - Seguimiento 2', color: 'bg-primary/20 text-primary-light' },
  { day: null, template: 'interest', label: 'Si responde +', color: 'bg-green-500/20 text-green-400' },
  { day: null, template: 'rejection_polite', label: 'Cierre', color: 'bg-red-500/20 text-red-400' },
]

export default function LinkedInOutreach() {
  const [templates, setTemplates] = useState(defaultTemplates)
  const [expandedTemplate, setExpandedTemplate] = useState(null)
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [editBody, setEditBody] = useState('')
  const [copied, setCopied] = useState(null)
  const [previewData, setPreviewData] = useState({
    nombre: 'Roberto Mendoza',
    industria: 'seguros y planeacion financiera',
    puesto: 'Consultor Financiero Senior',
    empresa_actual: 'GNP Seguros',
    reclutador: 'Ingrid Escobar',
    ubicacion: 'CDMX (hibrido)',
    salario: '$35,000 - $55,000 MXN',
  })

  function replaceVars(text) {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => previewData[key] || `{{${key}}}`)
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(replaceVars(text))
    setCopied(text)
    setTimeout(() => setCopied(null), 2000)
  }

  function startEdit(template) {
    setEditingTemplate(template.id)
    setEditBody(template.body)
  }

  function saveEdit(templateId) {
    setTemplates(prev => prev.map(t => t.id === templateId ? { ...t, body: editBody } : t))
    setEditingTemplate(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">LinkedIn Outreach</h1>
          <p className="text-gray-400 mt-1">Templates y secuencias de mensajes para prospeccion</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Templates', value: templates.length, icon: MessageSquare, gradient: 'from-primary/20 to-primary/5', color: 'text-primary' },
          { label: 'Pasos en secuencia', value: sequenceSteps.length, icon: Clock, gradient: 'from-accent/20 to-accent/5', color: 'text-accent' },
          { label: 'Variables', value: Object.keys(previewData).length, icon: Sparkles, gradient: 'from-gold/20 to-gold/5', color: 'text-gold' },
          { label: 'Herramienta', value: 'Waalaxy', icon: Send, gradient: 'from-green-500/20 to-green-500/5', color: 'text-green-400' },
        ].map(({ label, value, icon: Icon, gradient, color }) => (
          <div key={label} className="glass rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center ${color}`}><Icon size={18} /></div>
              <div><div className="text-lg font-bold text-white">{value}</div><div className="text-xs text-gray-400">{label}</div></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sequence visualization */}
        <div className="glass-strong rounded-2xl p-6">
          <h2 className="font-display font-semibold text-white mb-4">Secuencia automatica</h2>
          <div className="space-y-3">
            {sequenceSteps.map((step, i) => (
              <div key={i} className="relative pl-8">
                {i < sequenceSteps.length - 1 && <div className="absolute left-[11px] top-8 bottom-0 w-px bg-white/10" />}
                <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs text-gray-400">{i + 1}</div>
                <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${step.color}`}>{step.label}</span>
                  </div>
                  <p className="text-xs text-gray-400">{templates.find(t => t.id === step.template)?.name}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-accent/5 rounded-lg border border-accent/20">
            <h3 className="text-sm font-medium text-accent mb-2 flex items-center gap-2"><Sparkles size={14} /> Herramienta recomendada</h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Usa <strong className="text-white">Waalaxy</strong> (plan gratuito) para automatizar el envio. Importa los contactos desde tu banco de candidatos, carga estos templates y programa la secuencia.
            </p>
            <p className="text-xs text-gray-500 mt-2">Alternativas: Linked Helper ($15/mes), Octopus CRM, Snov.io</p>
          </div>
        </div>

        {/* Templates */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-white">Templates de mensajes</h2>
            {/* Preview variables */}
            <button onClick={() => setExpandedTemplate(expandedTemplate === 'vars' ? null : 'vars')} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
              <Sparkles size={12} /> Variables
              {expandedTemplate === 'vars' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>

          {expandedTemplate === 'vars' && (
            <div className="glass rounded-xl p-4 space-y-2">
              <p className="text-xs text-gray-500 mb-2">Edita las variables de preview:</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(previewData).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs text-primary font-mono whitespace-nowrap">{`{{${key}}}`}</span>
                    <input type="text" value={val} onChange={e => setPreviewData(p => ({ ...p, [key]: e.target.value }))}
                      className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-xs outline-none focus:border-primary/50" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {templates.map(template => (
            <div key={template.id} className="glass rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary-light">
                    <MessageSquare size={16} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">{template.name}</div>
                    <div className="text-xs text-gray-500">{template.stage}</div>
                  </div>
                </div>
                {expandedTemplate === template.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </button>

              {expandedTemplate === template.id && (
                <div className="px-4 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  {editingTemplate === template.id ? (
                    <div className="pt-3">
                      <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={8}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm font-mono outline-none focus:border-primary/50 resize-none" />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => saveEdit(template.id)} className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded text-xs font-medium hover:bg-green-500/30">Guardar</button>
                        <button onClick={() => setEditingTemplate(null)} className="px-3 py-1.5 text-gray-400 text-xs hover:text-white">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Preview */}
                      <div className="mt-3 p-3 bg-white/[0.02] rounded-lg border border-white/5">
                        <p className="text-xs text-gray-500 mb-2">Preview:</p>
                        <pre className="text-sm text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">{replaceVars(template.body)}</pre>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => copyToClipboard(template.body)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/20 text-primary-light rounded text-xs font-medium hover:bg-primary/30 transition-colors">
                          {copied === template.body ? <><CheckCircle size={12} /> Copiado</> : <><Copy size={12} /> Copiar mensaje</>}
                        </button>
                        <button onClick={() => startEdit(template)}
                          className="px-3 py-1.5 text-gray-400 text-xs hover:text-white transition-colors">Editar</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
