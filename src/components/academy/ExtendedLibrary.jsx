import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, BookOpen, Video, Lightbulb, Copy, Check,
  Search, ChevronDown, ChevronUp, Clock, BarChart3,
  GraduationCap, Sparkles, Filter, Play
} from 'lucide-react'

/* ═══════════════════════════════════════════════════
   1. CASOS PRACTICOS
   ═══════════════════════════════════════════════════ */

const CASES = [
  {
    id: 'caso-cto-fintech',
    title: 'Reclutamiento de CTO en startup fintech',
    difficulty: 'Avanzado',
    readTime: '8 min',
    situation: 'Una fintech mexicana con sede en CDMX buscaba su primer CTO despues de cerrar una ronda Serie A de $5M USD. El perfil requeria experiencia en sistemas bancarios regulados, liderazgo de equipos de 15+ ingenieros, y conocimiento profundo de compliance financiero (CNBV). El salario ofrecido estaba por debajo del mercado en 20% pero compensaba con equity del 2%.',
    challenge: 'El pool de candidatos con experiencia en fintech regulada en Mexico es extremadamente reducido: menos de 200 profesionales cumplen el perfil. La mayoria estan empleados en bancos tradicionales o fintechs mas grandes como Clip, Konfio o Stori, con paquetes superiores. Ademas, la startup no tenia marca empleadora reconocida y el puesto exigia reubicacion para quienes estaban fuera de CDMX.',
    solution: 'Se implemento una estrategia de headhunting en tres fases: (1) Mapeo exhaustivo del ecosistema fintech LATAM identificando 85 candidatos potenciales en LinkedIn, eventos como Finnosummit y publicaciones en Medium/GitHub. (2) Outreach personalizado que resaltaba el impacto directo en la mision de inclusion financiera, el equity como diferenciador, y la oportunidad de construir el equipo desde cero. (3) Proceso acelerado de 3 entrevistas en 10 dias para no perder momentum con candidatos pasivos. Se involucro al CEO directamente desde la primera llamada para transmitir vision.',
    results: 'Se contactaron 42 candidatos, 18 respondieron positivamente, 7 entraron al proceso completo y se presento una terna de 3 finalistas en 25 dias. El CTO seleccionado venia de una fintech en Colombia, acepto reubicarse, y nego un paquete que incluia equity del 2.5% + bono de reubicacion. Lleva 14 meses en el puesto y el equipo crecio de 8 a 22 ingenieros.',
    lessons: [
      'En posiciones C-Level fintech, el CEO debe estar involucrado desde el primer contacto para transmitir credibilidad.',
      'El equity es el diferenciador clave cuando el salario base no puede competir con corporativos.',
      'Ampliar la busqueda a LATAM (no solo Mexico) multiplica el pool de candidatos calificados por 3x.',
      'Un proceso acelerado reduce la perdida de candidatos pasivos que reciben contraofertas.',
    ],
  },
  {
    id: 'caso-masivo-retail',
    title: 'Contratacion masiva retail: 50 posiciones en 30 dias',
    difficulty: 'Intermedio',
    readTime: '7 min',
    situation: 'Una cadena de retail con 120 tiendas en el Bajio necesitaba contratar 50 ejecutivos de venta y cajeros para la apertura simultanea de 5 nuevas sucursales en Leon, Queretaro y San Luis Potosi. El timeline era de 30 dias desde la publicacion hasta onboarding completado. Los perfiles requeridos eran: edad 18-35, experiencia minima de 6 meses en atencion al cliente, disponibilidad de horarios rotativos.',
    challenge: 'La tasa de abandono en procesos masivos de retail en Mexico es del 60%. Los candidatos aplican a multiples ofertas simultaneamente y aceptan la primera que les responde. Ademas, las tres ciudades tienen mercados laborales distintos: Leon tiene alto empleo manufacturero que compite por el mismo talento, Queretaro tiene mayor oferta de perfiles calificados pero salarios mas altos, y SLP tiene menor rotacion pero menor pool disponible.',
    solution: 'Se diseno un proceso "express" completamente digital: (1) Landing page con chatbot de WhatsApp que realizaba pre-screening automatico en 3 minutos (edad, ubicacion, disponibilidad, experiencia). (2) Los candidatos aprobados recibian automaticamente un link de Calendly para entrevista grupal virtual el mismo dia o siguiente. (3) Entrevistas grupales de 8 candidatos con dinamica de roleplay de ventas de 45 minutos. (4) Oferta verbal al terminar la dinamica con carta enviada por WhatsApp dentro de 2 horas. (5) Onboarding digital con videos de capacitacion previo al primer dia.',
    results: 'Se recibieron 890 aplicaciones, 340 pasaron pre-screening automatico, 180 asistieron a dinamicas grupales, y 62 recibieron oferta. 54 se presentaron el primer dia (tasa de no-show de 13%, vs promedio industria de 25%). El costo por contratacion fue de $850 MXN vs el benchmark de $2,200 MXN. Tiempo promedio de proceso por candidato: 4 dias.',
    lessons: [
      'En contratacion masiva, la velocidad de respuesta es mas importante que la profundidad del proceso.',
      'WhatsApp supera al email 4:1 en tasa de respuesta para perfiles operativos en Mexico.',
      'Las entrevistas grupales con roleplay predicen mejor el desempeno en ventas que las entrevistas individuales.',
      'Enviar la oferta el mismo dia de la entrevista reduce el ghosting en un 40%.',
    ],
  },
  {
    id: 'caso-headhunting-director',
    title: 'Headhunting de Director Comercial confidencial',
    difficulty: 'Avanzado',
    readTime: '9 min',
    situation: 'Una empresa farmaceutica mexicana con $500M MXN en ventas anuales necesitaba reemplazar a su Director Comercial de forma confidencial. El director actual seria liquidado pero aun no lo sabia. El sucesor debia venir del sector farmaceutico o dispositivos medicos, con experiencia manejando equipos de 30+ representantes y red de contactos con distribuidores y cadenas de farmacias. Salario: $180K-$220K MXN mensuales + bono anual del 30%.',
    challenge: 'La confidencialidad era critica: si el director actual o la competencia se enteraban del proceso, podia generar inestabilidad en el equipo comercial y perdida de clientes clave. El sector farmaceutico en Mexico es relativamente pequeno y los directores comerciales se conocen entre si. Cualquier indiscrecion podia dañar relaciones comerciales. Ademas, los mejores candidatos estaban en multinacionales (Pfizer, Bayer, Roche) con paquetes superiores.',
    solution: 'Se ejecuto un proceso "blind search" en 4 etapas: (1) Investigacion sin revelar empresa: se contacto a 30 candidatos presentando la oportunidad como "empresa farmaceutica mexicana lider" sin revelar nombre. (2) NDA antes del primer detalle: los candidatos interesados firmaron acuerdo de confidencialidad digital antes de conocer el nombre de la empresa. (3) Entrevistas en ubicacion neutral: hotel boutique en Polanco, fuera de horario laboral, con el VP de Operaciones (no el CEO para evitar exposicion). (4) Assessment center en fin de semana con caso practico del sector.',
    results: 'De 30 candidatos contactados, 22 firmaron NDA, 12 avanzaron a entrevista presencial, y 4 llegaron al assessment center. El candidato seleccionado era VP Comercial en una farmaceutica de genéricos, acepto con negociacion de bono de permanencia a 18 meses. La transicion se ejecuto en 3 semanas sin que el equipo comercial supiera del proceso hasta el anuncio oficial. Zero filtraciones durante los 45 dias del proceso.',
    lessons: [
      'Los NDAs digitales (DocuSign) aceleran el proceso y dan seriedad al compromiso de confidencialidad.',
      'Entrevistas en ubicaciones neutrales y fuera de horario protegen a ambas partes.',
      'No revelar al CEO hasta etapas finales reduce el riesgo de filtración.',
      'El bono de permanencia protege la inversion en headhunting y reduce el riesgo de contratacion.',
    ],
  },
  {
    id: 'caso-transicion-ia',
    title: 'Transicion de reclutamiento tradicional a IA-assisted',
    difficulty: 'Intermedio',
    readTime: '8 min',
    situation: 'Una consultora de RH en Monterrey con 12 recruiters procesaba 200 vacantes mensuales con metodos tradicionales: busqueda manual en bolsas de trabajo, screening de CVs en Excel, y seguimiento por email. El tiempo promedio de llenado era 35 dias, la productividad por recruiter era 16 vacantes/mes, y el cliente mas grande amenazo con cancelar el contrato si no mejoraban tiempos a menos de 20 dias.',
    challenge: 'El equipo tenia resistencia al cambio. Tres recruiters senior con 10+ años de experiencia veian la IA como amenaza a su trabajo. La inversion en herramientas era limitada ($15K MXN/mes para todo el equipo). No habia personal de TI interno. Los procesos no estaban documentados y cada recruiter tenia su propio metodo. Ademas, los clientes exigian un toque personal que temia perderse con la automatizacion.',
    solution: 'Se implemento un plan de transformacion en 3 fases durante 90 dias: Fase 1 (Semanas 1-3): "Quick wins" - se introdujo ChatGPT y Claude para redaccion de JDs, boolean strings y mensajes de outreach. Se selecciono a 2 recruiters "champions" que adoptaron primero y documentaron resultados. Fase 2 (Semanas 4-8): Se implemento un ATS basico (Enlace 468) para centralizar candidatos y automatizar seguimiento. Se creo un sistema de prompts estandarizado para cada etapa del proceso. Fase 3 (Semanas 9-12): Se integro screening automatizado con scoring de CVs, templates de reportes automaticos para clientes, y dashboard de metricas en tiempo real.',
    results: 'A los 90 dias: tiempo de llenado bajo de 35 a 19 dias (-46%). Productividad por recruiter subio de 16 a 24 vacantes/mes (+50%). Los 3 recruiters resistentes se convirtieron en promotores despues de ver que la IA les ahorraba 2 horas diarias de trabajo administrativo. El cliente principal rento el contrato por 2 años. La consultora gano 3 clientes nuevos por la diferenciacion tecnologica.',
    lessons: [
      'Empezar con "quick wins" visibles (ahorro de tiempo en tareas especificas) reduce la resistencia al cambio.',
      'Los "champions" internos son mas efectivos que capacitacion externa para adopcion de IA.',
      'La IA no reemplaza al recruiter, le devuelve tiempo para tareas de alto valor como entrevistas y relación con clientes.',
      'Documentar resultados cuantitativos (horas ahorradas, dias reducidos) convence mas que argumentos cualitativos.',
    ],
  },
]

/* ═══════════════════════════════════════════════════
   2. CLASES GRABADAS
   ═══════════════════════════════════════════════════ */

const CLASSES = [
  {
    id: 'clase-boolean-search',
    title: 'Fundamentos de Boolean Search avanzado',
    duration: '45 min',
    difficulty: 'Intermedio',
    syllabus: [
      'Operadores booleanos en LinkedIn Recruiter vs LinkedIn free',
      'Construccion de strings para perfiles tech, comercial y ejecutivo',
      'X-ray search en Google para encontrar perfiles ocultos',
      'Uso de filtros avanzados combinados con boolean',
      'Practica: 10 busquedas reales para el mercado mexicano',
    ],
  },
  {
    id: 'clase-screening-cvs',
    title: 'Screening de CVs con criterios objetivos',
    duration: '35 min',
    difficulty: 'Basico',
    syllabus: [
      'Framework de evaluacion en 3 niveles: must-have, nice-to-have, red flags',
      'Como identificar logros cuantificables vs responsabilidades genericas',
      'Deteccion de inconsistencias y señales de alarma en CVs',
      'Creacion de scorecard de screening personalizada',
      'Uso de IA para pre-filtrado y ranking automatico de CVs',
    ],
  },
  {
    id: 'clase-entrevistas-competencias',
    title: 'Como conducir entrevistas por competencias',
    duration: '50 min',
    difficulty: 'Intermedio',
    syllabus: [
      'Modelo STAR/SOARA: como formular preguntas conductuales',
      'Diseño de guia de entrevista por perfil (tech, comercial, liderazgo)',
      'Tecnicas de escucha activa y follow-up questions',
      'Evaluacion objetiva: como evitar sesgos cognitivos comunes',
      'Calibracion de evaluadores: asegurar consistencia entre entrevistadores',
    ],
  },
  {
    id: 'clase-metricas-direccion',
    title: 'Metricas de reclutamiento que importan a la direccion',
    duration: '40 min',
    difficulty: 'Avanzado',
    syllabus: [
      'KPIs que los directivos realmente quieren ver (costo, tiempo, calidad)',
      'Como calcular ROI de reclutamiento y presentarlo en terminos financieros',
      'Dashboards ejecutivos: que incluir y que omitir',
      'Benchmarks del mercado mexicano por industria y nivel',
      'Storytelling con datos: como convertir metricas en narrativa de negocio',
    ],
  },
]

/* ═══════════════════════════════════════════════════
   3. PROMPTS MENSUALES
   ═══════════════════════════════════════════════════ */

const MONTHLY_PROMPTS = [
  {
    id: 'prompt-diversity',
    category: 'Diversidad e Inclusion',
    title: 'Evaluacion de diversidad en pipeline de candidatos',
    prompt: `Actua como consultor de diversidad e inclusion en reclutamiento para una empresa en Mexico. Analiza el siguiente pipeline de candidatos para la vacante de [PUESTO]:

Datos del pipeline:
- Total de candidatos: [NUMERO]
- Genero: [% MUJERES / % HOMBRES / % NO BINARIO]
- Rango de edad: [DISTRIBUCION]
- Universidades de origen: [LISTA]
- Ubicacion geografica: [DISTRIBUCION]

Proporciona:
1. Analisis de diversidad del pipeline actual vs benchmarks de la industria en Mexico
2. Identificacion de sesgos potenciales en el sourcing (fuentes, redaccion de JD, filtros)
3. 5 recomendaciones concretas para ampliar la diversidad sin comprometer calidad
4. Redaccion alternativa de 3 requisitos del JD que puedan estar excluyendo talento diverso
5. Fuentes de sourcing especificas en Mexico para talento subrepresentado (comunidades, universidades, organizaciones)

Importante: Las recomendaciones deben ser practicas y aplicables en el contexto laboral mexicano, considerando la Ley Federal del Trabajo y la NOM-035.`,
  },
  {
    id: 'prompt-passive-candidate',
    category: 'Candidatos Pasivos',
    title: 'Secuencia de engagement para candidato pasivo',
    prompt: `Actua como experto en engagement de candidatos pasivos en el mercado mexicano. Necesito una secuencia de 5 touchpoints para atraer a un [PUESTO] que actualmente trabaja en [EMPRESA ACTUAL] y no esta buscando empleo.

Contexto:
- Puesto que ofrecemos: [TITULO]
- Sueldo ofrecido: [RANGO]
- Ubicacion: [CIUDAD]
- Diferenciadores de nuestra oferta: [LISTAR 3]
- Perfil del candidato en LinkedIn: [RESUMEN BREVE]

Genera:
1. Mensaje de conexion en LinkedIn (max 300 caracteres, sin parecer reclutador)
2. Primer InMail/mensaje despues de conectar (enfocado en su trayectoria, no en la vacante)
3. Segundo mensaje 5 dias despues (compartir contenido relevante para su rol + mencion sutil de oportunidad)
4. Tercer mensaje: invitacion a conversacion de 15 min "off the record" sobre tendencias del sector
5. Mensaje de follow-up post-conversacion con propuesta formal

Tono: profesional pero cercano, sin ser invasivo. Considera la cultura empresarial mexicana donde la relacion personal precede a la negociacion.`,
  },
  {
    id: 'prompt-employer-branding',
    category: 'Employer Branding',
    title: 'Generador de contenido de employer branding',
    prompt: `Actua como estratega de employer branding para una empresa en Mexico. Genera un plan de contenido para posicionar a [EMPRESA] como empleador atractivo en el sector de [INDUSTRIA].

Datos de la empresa:
- Tamano: [NUMERO DE EMPLEADOS]
- Beneficios principales: [LISTAR]
- Cultura: [DESCRIBIR EN 2 LINEAS]
- Publico objetivo: [PERFIL DE CANDIDATO IDEAL]
- Plataformas activas: [LINKEDIN / INSTAGRAM / TIKTOK / GLASSDOOR]

Genera:
1. Calendario de contenido para 4 semanas (3 posts/semana) con:
   - Tema del post
   - Formato (carrusel, video corto, testimonio, behind-the-scenes)
   - Copy completo listo para publicar
   - Hashtags relevantes para Mexico

2. Script para 2 videos testimoniales de empleados (60 segundos cada uno):
   - Preguntas sugeridas
   - Estructura narrativa
   - Call to action

3. Template de respuesta para reviews en Glassdoor (positivas y negativas)

4. 3 ideas de activaciones internas que generen contenido organico (employee advocacy)

Todo el contenido debe sonar autentico, no corporativo. Usar lenguaje natural mexicano sin regionalismos extremos.`,
  },
  {
    id: 'prompt-salary-negotiation',
    category: 'Negociacion Salarial',
    title: 'Framework de negociacion de oferta laboral',
    prompt: `Actua como asesor experto en compensaciones y negociacion salarial en Mexico. El candidato seleccionado para [PUESTO] ha indicado que su expectativa salarial es [EXPECTATIVA] pero nuestro presupuesto maximo es [PRESUPUESTO].

Contexto:
- Puesto: [TITULO Y NIVEL]
- Sueldo mercado (Glassdoor/CompensaLab): [RANGO MERCADO]
- Nuestra oferta base: [MONTO]
- Beneficios incluidos: [LISTAR]
- Urgencia de contratacion: [ALTA/MEDIA/BAJA]
- Alternativas: [TENEMOS OTROS CANDIDATOS SI/NO]

Proporciona:
1. Analisis de competitividad de nuestra oferta vs mercado mexicano actual
2. Estrategia de negociacion en 3 escenarios:
   a) Candidato acepta con ajuste menor
   b) Candidato firme en su expectativa
   c) Candidato tiene contraoferta de su empresa actual
3. Script de conversacion para el recruiter (que decir y que NO decir)
4. Paquete de compensacion total alternativo que iguale la expectativa sin subir el sueldo base:
   - Bonos, vales, seguro de gastos medicos mayores
   - Dias de vacaciones adicionales, home office, horario flexible
   - Plan de crecimiento con revision salarial a 6 meses
5. Clausula de "claw-back" sugerida si se ofrece bono de firma

Considerar aspectos fiscales mexicanos (ISR, prevision social) para optimizar el paquete neto.`,
  },
  {
    id: 'prompt-reference-checking',
    category: 'Verificacion de Referencias',
    title: 'Guia de verificacion de referencias profesionales',
    prompt: `Actua como experto en verificacion de referencias profesionales para el mercado mexicano. Necesito validar al candidato finalista para [PUESTO] antes de emitir oferta formal.

Datos del candidato:
- Nombre: [NOMBRE]
- Puesto actual: [PUESTO ACTUAL EN EMPRESA]
- Puestos anteriores relevantes: [LISTAR 2-3]
- Competencias clave a validar: [LISTAR 4-5]
- Red flags detectados en entrevista: [DESCRIBIR SI HAY]

Genera:
1. Lista de 5 preguntas clave para el jefe directo anterior:
   - 2 preguntas sobre desempeno y resultados
   - 1 pregunta sobre areas de mejora (formulada para obtener respuesta honesta)
   - 1 pregunta sobre estilo de trabajo y relacion con equipo
   - 1 pregunta de cierre: "Volveria a contratarlo/a?"

2. Lista de 4 preguntas para un par/colega:
   - Enfocadas en colaboracion, comunicacion y confiabilidad

3. Script de apertura para la llamada (como presentarse, explicar confidencialidad, y hacer sentir comodo al referente)

4. Template para documentar las referencias en formato ejecutivo

5. Red flags a detectar durante la conversacion:
   - Señales de que la referencia esta siendo evasiva
   - Respuestas ensayadas vs autenticas
   - Inconsistencias con lo declarado por el candidato

Nota: Considerar que en Mexico muchas empresas tienen politica de solo confirmar fechas de empleo. Incluir estrategias para obtener informacion cualitativa a pesar de esta restriccion.`,
  },
]

/* ═══════════════════════════════════════════════════
   DIFFICULTY STYLES
   ═══════════════════════════════════════════════════ */

const DIFFICULTY_STYLES = {
  Basico: 'bg-green-500/20 text-green-400 border-green-500/30',
  Intermedio: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  Avanzado: 'bg-red-500/20 text-red-400 border-red-500/30',
}

/* ═══════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════ */

export default function ExtendedLibrary() {
  const [category, setCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedCase, setExpandedCase] = useState(null)
  const [expandedClass, setExpandedClass] = useState(null)
  const [copiedPrompt, setCopiedPrompt] = useState(null)

  const categories = [
    { key: 'all', label: 'Todos' },
    { key: 'cases', label: 'Casos practicos' },
    { key: 'classes', label: 'Clases grabadas' },
    { key: 'prompts', label: 'Prompts mensuales' },
  ]

  const copyPrompt = (id, text) => {
    navigator.clipboard.writeText(text)
    setCopiedPrompt(id)
    setTimeout(() => setCopiedPrompt(null), 2000)
  }

  const filterBySearch = (title) => {
    if (!searchTerm) return true
    return title.toLowerCase().includes(searchTerm.toLowerCase())
  }

  const showCases = (category === 'all' || category === 'cases')
  const showClasses = (category === 'all' || category === 'classes')
  const showPrompts = (category === 'all' || category === 'prompts')

  const filteredCases = CASES.filter(c => filterBySearch(c.title))
  const filteredClasses = CLASSES.filter(c => filterBySearch(c.title))
  const filteredPrompts = MONTHLY_PROMPTS.filter(p => filterBySearch(p.title))

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <Link to="/dashboard/academy" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ChevronLeft size={16} /> Academy
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/10 flex items-center justify-center">
            <BookOpen size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Biblioteca Extendida</h1>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Academy Plus
            </span>
          </div>
        </div>
        <p className="text-gray-400 text-sm mt-2">
          Casos practicos, clases grabadas y prompts avanzados para reclutadores que buscan diferenciarse.
        </p>
      </motion.div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                category === cat.key
                  ? 'bg-primary text-white'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar contenido..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-600 focus:border-primary/50 focus:outline-none"
          />
        </div>
      </div>

      {/* ─── CASOS PRACTICOS ─── */}
      {showCases && filteredCases.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Lightbulb size={18} className="text-amber-400" />
            <h2 className="text-lg font-display font-semibold text-white">Casos practicos</h2>
            <span className="text-xs text-gray-500">{filteredCases.length} casos</span>
          </div>
          <div className="space-y-4">
            {filteredCases.map((caseItem, i) => {
              const isExpanded = expandedCase === caseItem.id
              return (
                <motion.div
                  key={caseItem.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="glass rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedCase(isExpanded ? null : caseItem.id)}
                    className="w-full p-5 text-left flex items-start justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DIFFICULTY_STYLES[caseItem.difficulty]}`}>
                          {caseItem.difficulty}
                        </span>
                        <span className="text-[10px] text-gray-600 flex items-center gap-1">
                          <Clock size={10} /> {caseItem.readTime}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-white">{caseItem.title}</h3>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-500 mt-1 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-500 mt-1 flex-shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="pt-4">
                            <h4 className="text-xs font-semibold text-primary-light uppercase tracking-wider mb-2">Situacion</h4>
                            <p className="text-sm text-gray-300 leading-relaxed">{caseItem.situation}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">Desafio</h4>
                            <p className="text-sm text-gray-300 leading-relaxed">{caseItem.challenge}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Solucion</h4>
                            <p className="text-sm text-gray-300 leading-relaxed">{caseItem.solution}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Resultados</h4>
                            <p className="text-sm text-gray-300 leading-relaxed">{caseItem.results}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-violet-400 uppercase tracking-wider mb-2">Aprendizajes clave</h4>
                            <ul className="space-y-2">
                              {caseItem.lessons.map((lesson, li) => (
                                <li key={li} className="flex items-start gap-2 text-sm text-gray-300">
                                  <span className="text-violet-400 mt-0.5 flex-shrink-0">-</span>
                                  {lesson}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </div>
        </section>
      )}

      {/* ─── CLASES GRABADAS ─── */}
      {showClasses && filteredClasses.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Video size={18} className="text-red-400" />
            <h2 className="text-lg font-display font-semibold text-white">Clases grabadas</h2>
            <span className="text-xs text-gray-500">{filteredClasses.length} clases</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredClasses.map((cls, i) => {
              const isExpanded = expandedClass === cls.id
              return (
                <motion.div
                  key={cls.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="glass rounded-xl overflow-hidden"
                >
                  {/* Video Placeholder */}
                  <div className="relative h-36 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm">
                      <Play size={24} className="text-white ml-1" />
                    </div>
                    <span className="absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Proximamente
                    </span>
                    <span className="absolute bottom-3 right-3 text-[10px] text-gray-400 bg-black/50 px-2 py-0.5 rounded">
                      {cls.duration}
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DIFFICULTY_STYLES[cls.difficulty]}`}>
                        {cls.difficulty}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-3">{cls.title}</h3>
                    <button
                      onClick={() => setExpandedClass(isExpanded ? null : cls.id)}
                      className="text-xs text-primary-light font-medium flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      {isExpanded ? 'Ocultar temario' : 'Ver temario'}
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <ol className="mt-3 space-y-1.5 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            {cls.syllabus.map((topic, ti) => (
                              <li key={ti} className="flex items-start gap-2 text-xs text-gray-400">
                                <span className="text-primary-light font-semibold flex-shrink-0">{ti + 1}.</span>
                                {topic}
                              </li>
                            ))}
                          </ol>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </section>
      )}

      {/* ─── PROMPTS MENSUALES ─── */}
      {showPrompts && filteredPrompts.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles size={18} className="text-violet-400" />
            <h2 className="text-lg font-display font-semibold text-white">Nuevos prompts mensuales</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400">Mayo 2026</span>
          </div>
          <div className="space-y-4">
            {filteredPrompts.map((prompt, i) => (
              <motion.div
                key={prompt.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass rounded-xl p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-light">{prompt.category}</span>
                    <h3 className="text-sm font-semibold text-white mt-1">{prompt.title}</h3>
                  </div>
                  <button
                    onClick={() => copyPrompt(prompt.id, prompt.prompt)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
                      copiedPrompt === prompt.id
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {copiedPrompt === prompt.id ? <Check size={12} /> : <Copy size={12} />}
                    {copiedPrompt === prompt.id ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <pre className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap bg-white/[0.02] rounded-lg p-4 border border-white/5 max-h-48 overflow-y-auto font-sans">
                  {prompt.prompt}
                </pre>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {showCases && filteredCases.length === 0 && showClasses && filteredClasses.length === 0 && showPrompts && filteredPrompts.length === 0 && (
        <div className="text-center py-16">
          <Search size={40} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500">No se encontraron resultados para "{searchTerm}"</p>
        </div>
      )}
    </div>
  )
}
