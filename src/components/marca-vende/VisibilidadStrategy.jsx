import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, Eye, Copy, Check, Calendar, Hash,
  Users, CheckSquare, FileText
} from 'lucide-react'
import { usePlan } from '../../lib/planContext'
import UpgradePrompt from '../ui/UpgradePrompt'

/* ───────── CONTENT TEMPLATES ───────── */

const POST_TOPICS_BY_WEEK = [
  [
    'Historia profesional: tu camino hasta tu rol actual',
    'Leccion clave aprendida en tu ultimo proyecto',
    'Herramienta o recurso que te ha cambiado la productividad',
    'Opinion sobre una tendencia de tu industria',
    'Pregunta abierta a tu red sobre un tema relevante',
  ],
  [
    'Caso de exito: problema que resolviste y como',
    'Tip practico que otros profesionales pueden aplicar hoy',
    'Reflexion sobre un error que te hizo crecer',
    'Contenido curado: articulo o reporte con tu analisis',
    'Agradecimiento publico a un mentor o colega',
  ],
  [
    'Detras de camaras: un dia tipico en tu rol',
    'Framework o metodologia que usas y recomiendas',
    'Prediccion o vision sobre el futuro de tu industria',
    'Resultado medible que lograste (con datos)',
    'Invitacion a conectar: que buscas en tu red profesional',
  ],
  [
    'Contraste: como era tu industria antes vs ahora',
    'Lista de recursos recomendados (libros, podcasts, cursos)',
    'Post de liderazgo de pensamiento sobre un tema controversial',
    'Celebracion de un logro del equipo o proyecto',
    'Resumen del mes: aprendizajes y plan para el siguiente',
  ],
]

function generatePostTemplates(role, industry, skills) {
  const skillList = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : ['tu especialidad']
  const mainSkill = skillList[0] || 'tu area'

  return [
    {
      title: 'Post de Historia Profesional',
      content: `Hace [X] anios, cuando empece en ${industry || 'esta industria'}, nadie hablaba de ${mainSkill}.

Hoy, como ${role || 'profesional'}, puedo decir que fue la mejor decision especializarme en esto.

Tres cosas que aprendi en el camino:

1. [Primera leccion clave]
2. [Segunda leccion — algo contraintuitivo]
3. [Tercera leccion — la mas importante]

¿Cual ha sido tu mayor aprendizaje profesional? Me encantaria leer sus historias.

#${mainSkill.replace(/\s+/g, '')} #DesarrolloProfesional #Carrera`,
    },
    {
      title: 'Post de Caso de Exito',
      content: `El mes pasado enfrentamos un reto en ${industry || 'nuestro sector'}:

[Describe el problema en 1-2 oraciones]

Lo que hicimos diferente:
→ [Paso 1 — la estrategia]
→ [Paso 2 — la ejecucion]
→ [Paso 3 — el seguimiento]

Resultado: [metrica o resultado concreto]

La clave no fue la herramienta, sino [insight principal].

¿Han enfrentado algo similar? ¿Que les funciono?

#${(industry || 'Negocio').replace(/\s+/g, '')} #CasoDeExito #Resultados`,
    },
    {
      title: 'Post de Tip Practico',
      content: `5 cosas que hago todos los dias como ${role || 'profesional'} que me ahorran horas de trabajo:

1. [Habito o herramienta matutina]
2. [Tecnica de priorizacion]
3. [Automatizacion que implementaste]
4. [Forma de comunicacion efectiva]
5. [Ritual de cierre del dia]

El #3 fue un game-changer. Antes me tomaba [X tiempo], ahora [X resultado].

Guardalo para implementarlo esta semana.

#Productividad #${mainSkill.replace(/\s+/g, '')} #TipsLaborales`,
    },
    {
      title: 'Post de Opinion de Industria',
      content: `Opinion que no todos en ${industry || 'nuestra industria'} comparten:

[Tu opinion fuerte pero fundamentada sobre una tendencia]

Aqui esta mi razonamiento:

La mayoria piensa que [creencia comun].

Pero los datos muestran que [evidencia contraria o matiz].

En mi experiencia como ${role || 'profesional'}, he visto que [anecdota de soporte].

¿Que opinan? ¿Estoy equivocado?

(Los desacuerdos respetuosos son bienvenidos)

#LiderazgoDePensamiento #${(industry || 'Industria').replace(/\s+/g, '')} #Debate`,
    },
    {
      title: 'Post de Valor + CTA',
      content: `Si eres ${role || 'profesional'} en ${industry || 'tu industria'}, necesitas saber esto:

[Dato o insight valioso que pocos conocen]

¿Por que importa?

Porque [explicacion del impacto en 2-3 oraciones].

Llevo [X tiempo] especializandome en ${mainSkill} y este es uno de los insights mas valiosos que he encontrado.

Si quieres profundizar en este tema, [CTA: comenta, conectemos, DM abiertos].

Comparte si le puede servir a alguien de tu red.

#${mainSkill.replace(/\s+/g, '')} #ValorProfesional #LinkedIn`,
    },
  ]
}

function generateHashtags(role, industry, skills) {
  const base = ['LinkedIn', 'DesarrolloProfesional', 'Networking', 'Carrera']
  const industryTags = (industry || '').replace(/[\s\/]/g, '').split(',').filter(Boolean)
  const skillTags = (skills || '').split(',').map(s => s.trim().replace(/\s+/g, '')).filter(Boolean)
  const roleTags = (role || '').replace(/\s+/g, '').split(',').filter(Boolean)
  const combined = [...new Set([...industryTags, ...skillTags, ...roleTags, ...base])]
  return combined.slice(0, 10).map(tag => `#${tag}`)
}

function generateNetworkingPlan(role, industry) {
  return [
    `Conecta con 5 profesionales de ${industry || 'tu industria'} cada semana — envia solicitudes con nota personalizada mencionando algo especifico de su perfil.`,
    `Comenta en 3 publicaciones de lideres de opinion de ${industry || 'tu sector'} cada dia. Comentarios de valor (no solo "Gran post"), minimo 3 lineas con tu perspectiva.`,
    `Envia un mensaje directo a 2 contactos existentes por semana para reactivar relaciones. Pregunta sobre sus proyectos actuales o comparte un recurso relevante.`,
    `Participa en 1 evento virtual o presencial de ${industry || 'tu industria'} al mes. Publica un resumen con 3 takeaways clave despues del evento.`,
    `Identifica 3 grupos de LinkedIn relevantes para ${role || 'tu rol'} y contribuye con contenido original o respuestas a preguntas cada semana.`,
  ]
}

const PROFILE_CHECKLIST = [
  { item: 'Foto profesional de alta calidad (fondo neutro, buena iluminacion)', section: 'Visual' },
  { item: 'Banner personalizado con tu propuesta de valor o area de expertise', section: 'Visual' },
  { item: 'Headline optimizado con palabras clave (no solo tu titulo de puesto)', section: 'Encabezado' },
  { item: 'Seccion "Acerca de" con narrativa profesional (minimo 300 palabras)', section: 'Contenido' },
  { item: 'Experiencia laboral con logros cuantificados, no solo responsabilidades', section: 'Contenido' },
  { item: 'Minimo 5 habilidades principales validadas por contactos', section: 'Habilidades' },
  { item: 'Al menos 3 recomendaciones de colegas, jefes o clientes', section: 'Social proof' },
  { item: 'Enlace a portafolio, sitio web o proyecto destacado', section: 'Extras' },
  { item: 'Informacion de contacto actualizada y accesible', section: 'Contacto' },
  { item: 'Publicaciones recientes (al menos 1 por semana)', section: 'Actividad' },
  { item: 'Modo "Open to Work" o "Hiring" activado si aplica', section: 'Configuracion' },
  { item: 'URL personalizada de LinkedIn (sin numeros aleatorios)', section: 'Configuracion' },
]

/* ───────── MAIN COMPONENT ───────── */

export default function VisibilidadStrategy() {
  const { canDo } = usePlan()
  const [form, setForm] = useState({
    role: '', industry: '', skills: '', followers: '', frequency: '',
  })
  const [generated, setGenerated] = useState(null)
  const [copiedSection, setCopiedSection] = useState(null)
  const [activeTab, setActiveTab] = useState('calendar')

  if (!canDo('use_marca_vende')) {
    return <UpgradePrompt action="use_marca_vende" />
  }

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }))

  const handleGenerate = () => {
    const posts = generatePostTemplates(form.role, form.industry, form.skills)
    const hashtags = generateHashtags(form.role, form.industry, form.skills)
    const networking = generateNetworkingPlan(form.role, form.industry)
    setGenerated({ posts, hashtags, networking })
    setActiveTab('calendar')
  }

  const copyToClipboard = (text, sectionId) => {
    navigator.clipboard.writeText(text)
    setCopiedSection(sectionId)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const CopyButton = ({ text, id }) => (
    <button onClick={() => copyToClipboard(text, id)}
      className="flex items-center gap-1.5 text-xs font-medium text-primary-light hover:text-white transition-colors bg-primary/10 px-3 py-1.5 rounded-lg flex-shrink-0">
      {copiedSection === id ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
    </button>
  )

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary-light/30 focus:outline-none transition-colors'

  const tabs = [
    { key: 'calendar', label: 'Calendario', icon: Calendar },
    { key: 'posts', label: 'Plantillas', icon: FileText },
    { key: 'hashtags', label: 'Hashtags', icon: Hash },
    { key: 'networking', label: 'Networking', icon: Users },
    { key: 'checklist', label: 'Checklist', icon: CheckSquare },
  ]

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Link to="/dashboard/marca-vende" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ChevronLeft size={16} /> Tu Marca Vende
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold/20 to-primary/10 flex items-center justify-center">
            <Eye size={20} className="text-gold" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Estrategia de Visibilidad</h1>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500/10 text-purple-400">Pro</span>
        </div>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Genera una estrategia completa de visibilidad profesional en LinkedIn. Incluye calendario de contenido, plantillas de posts, hashtags y plan de networking.
        </p>
      </motion.div>

      {!generated ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-6 max-w-2xl">
          <h2 className="text-lg font-display font-semibold text-white mb-4">Tu perfil profesional</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Puesto objetivo o actual</label>
              <input type="text" value={form.role} onChange={e => update('role', e.target.value)}
                placeholder="Ej: Product Manager Senior, Director de Marketing" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Industria</label>
              <input type="text" value={form.industry} onChange={e => update('industry', e.target.value)}
                placeholder="Ej: Tecnologia, Fintech, Manufactura" className={inputCls} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Habilidades clave (separadas por coma)</label>
              <input type="text" value={form.skills} onChange={e => update('skills', e.target.value)}
                placeholder="Ej: Estrategia de producto, Agile, Data Analytics" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Seguidores actuales en LinkedIn</label>
                <input type="number" value={form.followers} onChange={e => update('followers', e.target.value)}
                  placeholder="Ej: 500" className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Frecuencia de publicacion actual</label>
                <input type="text" value={form.frequency} onChange={e => update('frequency', e.target.value)}
                  placeholder="Ej: 1 vez por semana" className={inputCls} />
              </div>
            </div>
            <button onClick={handleGenerate}
              className="w-full bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-2">
              <Eye size={16} />
              Generar Estrategia de Visibilidad
            </button>
          </div>
        </motion.div>
      ) : (
        <div>
          {/* Tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.key
                    ? 'bg-primary text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}>
                <t.icon size={16} />
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Calendar */}
            {activeTab === 'calendar' && (
              <motion.div key="calendar" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {POST_TOPICS_BY_WEEK.map((week, wi) => (
                  <div key={wi} className="glass rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">Semana {wi + 1}</h3>
                      <CopyButton text={week.map((t, i) => `Dia ${i + 1}: ${t}`).join('\n')} id={`week-${wi}`} />
                    </div>
                    <div className="space-y-2">
                      {week.map((topic, ti) => (
                        <div key={ti} className="flex items-start gap-3 text-sm">
                          <span className="text-xs font-bold text-primary-light bg-primary/10 px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">
                            {['Lun', 'Mar', 'Mie', 'Jue', 'Vie'][ti]}
                          </span>
                          <span className="text-gray-300">{topic}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Post Templates */}
            {activeTab === 'posts' && (
              <motion.div key="posts" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {generated.posts.map((post, i) => (
                  <div key={i} className="glass rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">{post.title}</h3>
                      <CopyButton text={post.content} id={`post-${i}`} />
                    </div>
                    <div className="bg-black/30 rounded-lg p-4 border border-white/10">
                      <pre className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">{post.content}</pre>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Hashtags */}
            {activeTab === 'hashtags' && (
              <motion.div key="hashtags" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Hashtags recomendados</h3>
                    <CopyButton text={generated.hashtags.join(' ')} id="hashtags" />
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {generated.hashtags.map((tag, i) => (
                      <span key={i} className="px-3 py-1.5 bg-primary/10 text-primary-light rounded-full text-sm font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Usa 3-5 hashtags por publicacion. Combina hashtags de alto volumen (100k+ seguidores) con hashtags de nicho
                    para maximizar alcance y relevancia. Rota los hashtags entre publicaciones.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Networking Plan */}
            {activeTab === 'networking' && (
              <motion.div key="networking" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Plan de Networking Semanal</h3>
                    <CopyButton text={generated.networking.map((a, i) => `${i + 1}. ${a}`).join('\n\n')} id="networking" />
                  </div>
                  <div className="space-y-3">
                    {generated.networking.map((action, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm bg-white/5 rounded-lg p-3">
                        <span className="text-xs font-bold text-accent-light bg-accent/10 px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5">{i + 1}</span>
                        <p className="text-gray-300 leading-relaxed">{action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Profile Checklist */}
            {activeTab === 'checklist' && (
              <motion.div key="checklist" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="glass rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Checklist de Optimizacion de Perfil</h3>
                    <CopyButton text={PROFILE_CHECKLIST.map(c => `[ ] ${c.item}`).join('\n')} id="checklist" />
                  </div>
                  <div className="space-y-2">
                    {PROFILE_CHECKLIST.map((item, i) => (
                      <ProfileCheckItem key={i} item={item} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={() => setGenerated(null)}
            className="mt-6 text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1">
            <ChevronLeft size={14} /> Generar nueva estrategia
          </button>
        </div>
      )}
    </div>
  )
}

function ProfileCheckItem({ item }) {
  const [checked, setChecked] = useState(false)

  return (
    <button onClick={() => setChecked(!checked)}
      className={`w-full flex items-start gap-3 text-left p-3 rounded-lg transition-all ${checked ? 'bg-emerald-500/5' : 'bg-white/5 hover:bg-white/8'}`}>
      <div className={`w-5 h-5 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
        checked ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'
      }`}>
        {checked && <Check size={12} className="text-white" />}
      </div>
      <div>
        <span className={`text-sm transition-colors ${checked ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{item.item}</span>
        <span className="text-[10px] text-gray-600 ml-2 uppercase tracking-wider">{item.section}</span>
      </div>
    </button>
  )
}
