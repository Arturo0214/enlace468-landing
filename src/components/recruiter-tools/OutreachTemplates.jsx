import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { MessageSquare, Copy, Check, ChevronLeft, Send, Mail, MessageCircle, Edit3, X } from 'lucide-react'

const templateCategories = [
  {
    key: 'linkedin',
    label: 'LinkedIn InMail',
    icon: Send,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    templates: [
      {
        name: 'Primer contacto - Directo profesional',
        content: `Hola {nombre},

Vi tu perfil y tu experiencia como {titulo_actual} en {empresa_actual} me parecio muy interesante. Estoy trabajando una posicion de {puesto} para {empresa}, una empresa lider en {industria}.

El rol ofrece {beneficio_clave} y creo que tu trayectoria podria ser un excelente match.

Te gustaria que te comparta mas detalles? Quedo atento.

Saludos,
{tu_nombre}
{tu_titulo}`,
      },
      {
        name: 'Primer contacto - Oportunidad confidencial',
        content: `Hola {nombre},

Te escribo porque estoy manejando una busqueda confidencial para una posicion de {puesto} en una empresa top del sector {industria} en {ubicacion}.

Tu perfil llamo mi atencion por {razon_especifica}. Sin compromiso, me gustaria platicarte los detalles de la oportunidad.

Tienes 15 minutos esta semana para una llamada breve?

Saludos cordiales,
{tu_nombre}`,
      },
      {
        name: 'Follow-up - Recordatorio amigable',
        content: `Hola {nombre}, espero que estes muy bien!

Te escribi hace unos dias sobre la oportunidad de {puesto} en {empresa}. Entiendo que puedes estar ocupado/a, asi que solo queria asegurarme de que hayas visto mi mensaje.

La posicion sigue abierta y creo que vale la pena que platiquemos. Incluso si no es el momento ideal, me encantaria conocer tu perspectiva.

Quedo a tus ordenes,
{tu_nombre}`,
      },
      {
        name: 'Follow-up - Compartir mas detalles',
        content: `Hola de nuevo {nombre},

Para darte mas contexto sobre la vacante de {puesto}:

- Empresa: {empresa} ({industria})
- Ubicacion: {ubicacion}
- Rango salarial: {rango_salarial}
- Beneficios destacados: {beneficios}

Si te interesa explorar la oportunidad, con gusto te comparto la descripcion completa y coordinamos una llamada.

Saludos,
{tu_nombre}`,
      },
      {
        name: 'Cierre - Candidato no interesado (pedir referido)',
        content: `Hola {nombre}, gracias por tu respuesta y por tomarte el tiempo de considerarlo.

Entiendo perfectamente tu decision. Si en algun momento tu situacion cambia, no dudes en contactarme.

Por cierto, conoces a alguien en tu red que pudiera estar interesado/a en esta oportunidad de {puesto}? Cualquier recomendacion seria muy valiosa.

Te deseo mucho exito!
{tu_nombre}`,
      },
    ],
  },
  {
    key: 'email',
    label: 'Email',
    icon: Mail,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    templates: [
      {
        name: 'Invitacion a proceso - Formal',
        content: `Asunto: Oportunidad profesional - {puesto} en {empresa}

Estimado/a {nombre},

Mi nombre es {tu_nombre} y soy {tu_titulo} en {tu_empresa}. Me permito contactarle porque su perfil profesional resulta altamente compatible con una posicion que estamos trabajando actualmente.

Posicion: {puesto}
Empresa: {empresa}
Ubicacion: {ubicacion}
Modalidad: {modalidad}

La posicion ofrece un paquete competitivo que incluye {beneficios_clave}.

De ser de su interes, me gustaria agendar una llamada de 20 minutos para compartirle los detalles completos del rol y conocer sus expectativas.

Puede confirmarme su disponibilidad respondiendo este correo o al numero {telefono}.

Quedo a sus ordenes.

Atentamente,
{tu_nombre}
{tu_titulo} | {tu_empresa}
{telefono}`,
      },
      {
        name: 'Siguiente paso - Agendar entrevista',
        content: `Asunto: Siguiente paso en tu proceso - {empresa}

Hola {nombre},

Muchas gracias por tu interes en la posicion de {puesto}. Despues de revisar tu perfil, nos gustaria invitarte a la siguiente etapa del proceso.

Entrevista: {tipo_entrevista}
Duracion estimada: {duracion}
Formato: {formato}

Te comparto las siguientes opciones de horario:
- {opcion_1}
- {opcion_2}
- {opcion_3}

Por favor confirma cual horario te funciona mejor respondiendo este correo.

Preparacion sugerida: {preparacion}

Saludos,
{tu_nombre}
{tu_empresa}`,
      },
      {
        name: 'Oferta informal - Antes de carta formal',
        content: `Asunto: Buenas noticias - Proceso {puesto}

Hola {nombre},

Me da mucho gusto comunicarte que despues de evaluar a todos los candidatos, {empresa} ha decidido que tu eres la persona ideal para la posicion de {puesto}.

Antes de enviarte la carta oferta formal, me gustaria validar contigo los siguientes puntos:

- Salario mensual bruto: {salario}
- Prestaciones: {prestaciones}
- Fecha de ingreso propuesta: {fecha_ingreso}
- Modalidad: {modalidad}

Por favor confirmame si estos terminos son aceptables para ti o si hay algo que te gustaria discutir antes de formalizar.

Felicidades!

{tu_nombre}
{tu_empresa}`,
      },
    ],
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: MessageCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    templates: [
      {
        name: 'Primer contacto - Breve y directo',
        content: `Hola {nombre}, buen dia!

Soy {tu_nombre} de {tu_empresa}. Encontre tu perfil y me gustaria platicarte sobre una oportunidad como {puesto} en {empresa}.

El puesto es en {ubicacion} con un paquete muy competitivo. Te interesaria que te comparta los detalles?`,
      },
      {
        name: 'Confirmacion de entrevista',
        content: `Hola {nombre}!

Te confirmo tu entrevista para la posicion de {puesto} en {empresa}:

Fecha: {fecha}
Hora: {hora}
Formato: {formato}
{datos_adicionales}

Por favor confirma que todo este bien. Si necesitas reagendar, avisame con anticipacion.

Mucho exito!
{tu_nombre}`,
      },
      {
        name: 'Seguimiento post-entrevista',
        content: `Hola {nombre}!

Como te fue en la entrevista de {puesto}? Me gustaria saber tu impresion y si tienes alguna pregunta adicional sobre la posicion o la empresa.

Tu feedback me ayuda a darte un mejor acompanamiento en el proceso.

Quedo atento!
{tu_nombre}`,
      },
    ],
  },
]

export default function OutreachTemplates() {
  const [activeCategory, setActiveCategory] = useState('linkedin')
  const [editingIdx, setEditingIdx] = useState(null)
  const [editText, setEditText] = useState('')
  const [copiedIdx, setCopiedIdx] = useState(null)

  const category = templateCategories.find(c => c.key === activeCategory)

  const handleCopy = async (text, idx) => {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  const handleEdit = (idx, content) => {
    setEditingIdx(idx)
    setEditText(content)
  }

  const handleCopyEdited = async () => {
    await navigator.clipboard.writeText(editText)
    setCopiedIdx(editingIdx)
    setEditingIdx(null)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <Link to="/dashboard/recruiter-tools" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ChevronLeft size={16} /> Recruiter Pro Tools
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent/20 to-gold/10 flex items-center justify-center">
            <MessageSquare size={20} className="text-accent-light" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Plantillas de Outreach</h1>
        </div>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Templates listos para usar en LinkedIn, email y WhatsApp. Las variables en <span className="text-primary-light">color</span> se reemplazan con los datos de tu candidato.
        </p>
      </motion.div>

      {/* Category tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex gap-2 mb-6"
      >
        {templateCategories.map(cat => {
          const Icon = cat.icon
          return (
            <button
              key={cat.key}
              onClick={() => { setActiveCategory(cat.key); setEditingIdx(null) }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                cat.key === activeCategory
                  ? `${cat.bgColor} ${cat.color} border border-current/20`
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <Icon size={16} />
              {cat.label}
              <span className="text-xs opacity-60">({cat.templates.length})</span>
            </button>
          )
        })}
      </motion.div>

      {/* Templates */}
      <div className="space-y-4">
        {category.templates.map((tmpl, idx) => (
          <motion.div
            key={`${activeCategory}-${idx}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
            className="glass rounded-xl p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">{tmpl.name}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(idx, tmpl.content)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-lg"
                >
                  <Edit3 size={12} />
                  Personalizar
                </button>
                <button
                  onClick={() => handleCopy(tmpl.content, idx)}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-1.5 rounded-lg ${
                    copiedIdx === idx
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-primary/10 text-primary-light hover:text-white'
                  }`}
                >
                  {copiedIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                  {copiedIdx === idx ? 'Copiado' : 'Usar template'}
                </button>
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <pre className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                {tmpl.content.split(/(\{[^}]+\})/).map((part, i) =>
                  part.startsWith('{') ? (
                    <span key={i} className="text-primary-light font-medium">{part}</span>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </pre>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {editingIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={() => setEditingIdx(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-strong rounded-xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-bold text-white">Personalizar plantilla</h3>
                <button onClick={() => setEditingIdx(null)} className="text-gray-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={14}
                className="w-full flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:border-primary-light/30 focus:outline-none focus:ring-1 focus:ring-primary-light/20 transition-colors resize-none font-mono leading-relaxed"
              />
              <div className="flex gap-3 mt-4 justify-end">
                <button
                  onClick={() => setEditingIdx(null)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCopyEdited}
                  className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm px-5 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                  <Copy size={14} />
                  Copiar personalizado
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
