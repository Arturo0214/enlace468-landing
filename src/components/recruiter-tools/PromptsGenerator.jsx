import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Wand2, Copy, Check, ChevronLeft, ChevronDown } from 'lucide-react'

const categories = [
  {
    key: 'sourcing',
    label: 'Sourcing',
    description: 'Encuentra candidatos ideales',
    templates: [
      {
        name: 'Boolean Search para LinkedIn',
        template: 'Genera una boolean search string para LinkedIn para encontrar candidatos de {puesto} en {ubicacion} con experiencia en {habilidades}. Incluye variaciones de titulo en espanol e ingles.',
        fields: [
          { key: 'puesto', label: 'Puesto', placeholder: 'Ej: Desarrollador Full Stack' },
          { key: 'ubicacion', label: 'Ubicacion', placeholder: 'Ej: Ciudad de Mexico' },
          { key: 'habilidades', label: 'Habilidades', placeholder: 'Ej: React, Node.js, AWS' },
        ],
      },
      {
        name: 'Analisis de perfil de candidato',
        template: 'Analiza este perfil de LinkedIn y dame 5 razones por las que seria buen candidato para {puesto} en {empresa}: {url_o_descripcion}',
        fields: [
          { key: 'puesto', label: 'Puesto', placeholder: 'Ej: Gerente de Ventas' },
          { key: 'empresa', label: 'Empresa', placeholder: 'Ej: Grupo Bimbo' },
          { key: 'url_o_descripcion', label: 'URL o descripcion del perfil', placeholder: 'Pega la URL de LinkedIn o una descripcion del perfil' },
        ],
      },
      {
        name: 'Mapeo de talento',
        template: 'Genera un mapeo de talento para {industria} en {ubicacion}. Lista las 10 empresas mas relevantes donde buscar candidatos de {puesto} y por que.',
        fields: [
          { key: 'industria', label: 'Industria', placeholder: 'Ej: Fintech' },
          { key: 'ubicacion', label: 'Ubicacion', placeholder: 'Ej: Monterrey, NL' },
          { key: 'puesto', label: 'Puesto', placeholder: 'Ej: Product Manager' },
        ],
      },
    ],
  },
  {
    key: 'screening',
    label: 'Screening',
    description: 'Evalua CVs y candidatos',
    templates: [
      {
        name: 'Evaluacion de CV vs requisitos',
        template: 'Evalua este CV contra los siguientes requisitos de la vacante. Requisitos: {requisitos}. CV: {cv_text}. Dame un score de 1-10 y justificacion.',
        fields: [
          { key: 'requisitos', label: 'Requisitos de la vacante', placeholder: 'Ej: 5 anios de experiencia en ventas B2B, ingles avanzado...' },
          { key: 'cv_text', label: 'Texto del CV', placeholder: 'Pega aqui el contenido del CV' },
        ],
      },
      {
        name: 'Red flags y green flags',
        template: 'Identifica red flags y green flags en este CV para el puesto de {puesto}: {cv_text}',
        fields: [
          { key: 'puesto', label: 'Puesto', placeholder: 'Ej: Director Comercial' },
          { key: 'cv_text', label: 'Texto del CV', placeholder: 'Pega aqui el contenido del CV' },
        ],
      },
      {
        name: 'Comparativa de candidatos',
        template: 'Compara estos {n} candidatos para {puesto} y genera una matriz de comparacion: {candidatos}',
        fields: [
          { key: 'n', label: 'Numero de candidatos', placeholder: 'Ej: 3' },
          { key: 'puesto', label: 'Puesto', placeholder: 'Ej: Contador Senior' },
          { key: 'candidatos', label: 'Descripcion de candidatos', placeholder: 'Candidato 1: Maria Lopez, 8 anios en contabilidad...\nCandidato 2: ...' },
        ],
      },
    ],
  },
  {
    key: 'outreach',
    label: 'Outreach',
    description: 'Mensajes de contacto',
    templates: [
      {
        name: 'Primer contacto por LinkedIn',
        template: 'Genera un mensaje de primer contacto por LinkedIn para {nombre_candidato} que es {titulo_actual} en {empresa_actual}. La vacante es {puesto} en {empresa}. Tono: {tono}.',
        fields: [
          { key: 'nombre_candidato', label: 'Nombre del candidato', placeholder: 'Ej: Juan Perez' },
          { key: 'titulo_actual', label: 'Titulo actual', placeholder: 'Ej: Senior Developer' },
          { key: 'empresa_actual', label: 'Empresa actual', placeholder: 'Ej: Mercado Libre' },
          { key: 'puesto', label: 'Vacante', placeholder: 'Ej: Tech Lead' },
          { key: 'empresa', label: 'Tu empresa', placeholder: 'Ej: Kavak' },
          { key: 'tono', label: 'Tono', placeholder: 'profesional / casual / directo' },
        ],
      },
      {
        name: 'Follow-up sin respuesta',
        template: 'Escribe un follow-up para un candidato que no respondio el primer mensaje hace {dias} dias. Contexto original: {contexto}',
        fields: [
          { key: 'dias', label: 'Dias desde el primer contacto', placeholder: 'Ej: 5' },
          { key: 'contexto', label: 'Contexto del primer mensaje', placeholder: 'Ej: Le escribi sobre una posicion de PM en fintech...' },
        ],
      },
      {
        name: 'Secuencia de outreach completa',
        template: 'Genera una secuencia de 3 mensajes de outreach (inicial, follow-up 1, follow-up 2) para la vacante de {puesto}.',
        fields: [
          { key: 'puesto', label: 'Puesto', placeholder: 'Ej: Data Engineer' },
        ],
      },
    ],
  },
  {
    key: 'entrevista',
    label: 'Entrevista',
    description: 'Preparacion de entrevistas',
    templates: [
      {
        name: 'Preguntas de entrevista STAR',
        template: 'Genera 10 preguntas de entrevista para {puesto} enfocadas en {competencias}. Incluye preguntas conductuales STAR.',
        fields: [
          { key: 'puesto', label: 'Puesto', placeholder: 'Ej: Gerente de Operaciones' },
          { key: 'competencias', label: 'Competencias clave', placeholder: 'Ej: liderazgo, resolucion de problemas, trabajo en equipo' },
        ],
      },
      {
        name: 'Preguntas basadas en CV',
        template: 'A partir de este CV, genera 5 preguntas especificas para validar la experiencia del candidato: {cv_text}',
        fields: [
          { key: 'cv_text', label: 'Texto del CV', placeholder: 'Pega aqui el contenido del CV' },
        ],
      },
      {
        name: 'Scorecard de entrevista',
        template: 'Crea un scorecard de entrevista para {puesto} con las competencias: {competencias}. Incluye escala 1-5 y criterios de evaluacion.',
        fields: [
          { key: 'puesto', label: 'Puesto', placeholder: 'Ej: Analista de Datos' },
          { key: 'competencias', label: 'Competencias', placeholder: 'Ej: SQL, Python, comunicacion, pensamiento analitico' },
        ],
      },
    ],
  },
  {
    key: 'reportes',
    label: 'Reportes',
    description: 'Reportes y metricas',
    templates: [
      {
        name: 'Resumen ejecutivo de pipeline',
        template: 'Genera un resumen ejecutivo del pipeline de la vacante {puesto}. Datos: {n_sourced} sourced, {n_contacted} contactados, {n_interviewing} en entrevista, {n_presented} presentados. Incluye recomendaciones.',
        fields: [
          { key: 'puesto', label: 'Puesto', placeholder: 'Ej: Desarrollador Backend' },
          { key: 'n_sourced', label: 'Candidatos sourced', placeholder: 'Ej: 50' },
          { key: 'n_contacted', label: 'Contactados', placeholder: 'Ej: 30' },
          { key: 'n_interviewing', label: 'En entrevista', placeholder: 'Ej: 8' },
          { key: 'n_presented', label: 'Presentados', placeholder: 'Ej: 3' },
        ],
      },
      {
        name: 'Reporte de cierre de vacante',
        template: 'Redacta un reporte de cierre de vacante para {puesto}. Candidato seleccionado: {nombre}. Tiempo total: {dias} dias. Incluye metricas clave.',
        fields: [
          { key: 'puesto', label: 'Puesto', placeholder: 'Ej: CFO' },
          { key: 'nombre', label: 'Candidato seleccionado', placeholder: 'Ej: Ana Garcia' },
          { key: 'dias', label: 'Dias totales del proceso', placeholder: 'Ej: 45' },
        ],
      },
    ],
  },
]

export default function PromptsGenerator() {
  const [selectedCategory, setSelectedCategory] = useState(categories[0].key)
  const [selectedTemplate, setSelectedTemplate] = useState(0)
  const [fieldValues, setFieldValues] = useState({})
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [copied, setCopied] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)

  const category = categories.find(c => c.key === selectedCategory)
  const template = category.templates[selectedTemplate]

  const handleCategoryChange = (key) => {
    setSelectedCategory(key)
    setSelectedTemplate(0)
    setFieldValues({})
    setGeneratedPrompt('')
    setCategoryOpen(false)
  }

  const handleTemplateChange = (idx) => {
    setSelectedTemplate(idx)
    setFieldValues({})
    setGeneratedPrompt('')
  }

  const handleFieldChange = (key, value) => {
    setFieldValues(prev => ({ ...prev, [key]: value }))
  }

  const handleGenerate = () => {
    let result = template.template
    template.fields.forEach(f => {
      const val = fieldValues[f.key] || `[${f.label}]`
      result = result.replaceAll(`{${f.key}}`, val)
    })
    setGeneratedPrompt(result)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
            <Wand2 size={20} className="text-primary-light" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Generador de Prompts IA</h1>
        </div>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Selecciona una categoria y plantilla, completa los campos y genera un prompt listo para usar con ChatGPT, Claude o cualquier IA.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Category & Template selection */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 space-y-4"
        >
          {/* Category selector */}
          <div className="glass rounded-xl p-4">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Categoria</label>
            <div className="relative">
              <button
                onClick={() => setCategoryOpen(!categoryOpen)}
                className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white hover:border-white/20 transition-colors"
              >
                <span>{category.label} - {category.description}</span>
                <ChevronDown size={16} className={`transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {categoryOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-10 w-full mt-1 glass-strong rounded-lg border border-white/10 overflow-hidden"
                  >
                    {categories.map(c => (
                      <button
                        key={c.key}
                        onClick={() => handleCategoryChange(c.key)}
                        className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                          c.key === selectedCategory
                            ? 'bg-primary/10 text-primary-light'
                            : 'text-gray-300 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className="font-medium">{c.label}</span>
                        <span className="text-gray-500 ml-2">- {c.description}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Template list */}
          <div className="glass rounded-xl p-4">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Plantillas</label>
            <div className="space-y-2">
              {category.templates.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTemplateChange(idx)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
                    idx === selectedTemplate
                      ? 'bg-primary/10 text-primary-light border border-primary-light/20'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right: Form + Output */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* Template preview */}
          <div className="glass rounded-xl p-4">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Plantilla</label>
            <p className="text-sm text-gray-300 leading-relaxed bg-white/5 rounded-lg p-3 border border-white/10">
              {template.template.split(/(\{[^}]+\})/).map((part, i) =>
                part.startsWith('{') ? (
                  <span key={i} className="text-primary-light font-medium">{part}</span>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </p>
          </div>

          {/* Input fields */}
          <div className="glass rounded-xl p-4">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 block">Completa los campos</label>
            <div className="space-y-3">
              {template.fields.map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-400 mb-1 block">{f.label}</label>
                  {f.placeholder && f.placeholder.length > 60 ? (
                    <textarea
                      rows={3}
                      value={fieldValues[f.key] || ''}
                      onChange={e => handleFieldChange(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary-light/30 focus:outline-none focus:ring-1 focus:ring-primary-light/20 transition-colors resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={fieldValues[f.key] || ''}
                      onChange={e => handleFieldChange(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-primary-light/30 focus:outline-none focus:ring-1 focus:ring-primary-light/20 transition-colors"
                    />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleGenerate}
              className="mt-4 w-full bg-gradient-to-r from-primary to-accent text-white font-semibold text-sm py-2.5 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Wand2 size={16} />
              Generar Prompt
            </button>
          </div>

          {/* Generated prompt */}
          <AnimatePresence>
            {generatedPrompt && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="glass-strong rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Prompt generado</label>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary-light hover:text-white transition-colors bg-primary/10 px-3 py-1.5 rounded-lg"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <div className="bg-black/30 rounded-lg p-4 border border-white/10">
                  <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-mono">
                    {generatedPrompt}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
