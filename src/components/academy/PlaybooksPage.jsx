import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, BookOpen, ArrowRight, ArrowLeft, Copy, Check,
  Code, Crown, Users, Cpu
} from 'lucide-react'
import { usePlan } from '../../lib/planContext'
import UpgradePrompt from '../ui/UpgradePrompt'

const PLAYBOOKS = [
  {
    id: 'tech-mexico',
    title: 'Reclutamiento Tech en Mexico',
    subtitle: 'Guia completa para atraer talento tecnologico en el mercado mexicano',
    icon: Code,
    gradient: 'from-blue-500/20 to-cyan-500/10',
    iconColor: 'text-blue-400',
    preview: 'Estrategias probadas para sourcear, evaluar y cerrar desarrolladores, data engineers, product managers y mas en un mercado ultra competido.',
    content: `PLAYBOOK: RECLUTAMIENTO TECH EN MEXICO
================================================================

1. ENTENDER EL MERCADO TECH MEXICANO

El mercado de talento tech en Mexico tiene caracteristicas unicas que todo reclutador debe conocer:

Principales hubs tecnologicos:
- Ciudad de Mexico: Ecosistema mas grande. Sede de unicornios como Kavak, Clip, Bitso. Startups de Serie A-C compiten por el mismo talento que corporativos como Google, Amazon y Microsoft.
- Guadalajara: "Silicon Valley mexicano". Fuerte presencia de empresas de hardware (Intel, Oracle, HP) y creciente ecosistema de startups. Talento con perfil mas orientado a ingenieria.
- Monterrey: Hub industrial con creciente adopcion tech. Empresas como Softtek, Neoris y startups fintech. Perfil de talento mas corporativo.
- Merida y Queretaro: Hubs emergentes con talento mas disponible y expectativas salariales 15-25% menores que CDMX.

Rangos salariales de referencia (2026, pesos mexicanos mensuales brutos):
- Junior Developer (0-2 anios): $18,000 - $30,000
- Mid Developer (2-5 anios): $30,000 - $55,000
- Senior Developer (5+ anios): $55,000 - $90,000
- Tech Lead / Staff: $80,000 - $130,000
- Engineering Manager: $100,000 - $160,000
- VP/CTO: $150,000 - $300,000+

Nota: Empresas con compensacion en USD (nearshoring) pagan 30-50% mas.

2. SOURCING ESTRATEGICO

Canales principales por efectividad:
a) LinkedIn Recruiter: Sigue siendo el #1. Usa busquedas booleanas con variaciones en espanol e ingles. Los developers mexicanos suelen tener perfiles bilingues.

b) GitHub y Stack Overflow: Para roles de ingenieria, revisa contribuciones open source. Un perfil activo en GitHub dice mas que cualquier CV.

c) Comunidades tech mexicanas:
   - SG Buzz (comunidad de software en Mexico)
   - Meetups locales (CDMX.js, Python CDMX, DevOps CDMX)
   - Twitter/X tech mexicano
   - Discord y Slack de comunidades (Codea, Platzi, Codigo Facilito)

d) Universidades y bootcamps:
   - ITESM, UNAM, IPN, UAM (talento universitario)
   - Ironhack, Le Wagon, Devf, Platzi (bootcamps)
   - Los egresados de bootcamp suelen ser mas junior pero con alta motivacion

Boolean search ejemplo para Full Stack Developer en Mexico:
("full stack" OR fullstack OR "software engineer" OR "desarrollador") AND (React OR Angular OR Vue) AND (Node OR Python OR Java) AND (Mexico OR CDMX OR remoto) NOT (intern OR becario OR practicante)

3. EVALUACION TECNICA

Framework de evaluacion en 3 etapas:

Etapa 1 - Screening tecnico (30 min):
- Valida experiencia con preguntas sobre proyectos reales
- No hagas preguntas de trivia (¿que es un closure?)
- Pregunta: "Cuentame sobre el proyecto mas complejo que hayas construido. ¿Cual fue tu contribucion especifica?"

Etapa 2 - Prueba tecnica (take-home o live coding):
- Take-home: Maximo 3-4 horas. Debe ser un problema real, no algoritmico
- Live coding: 60-90 min. Pair programming > whiteboard
- Evalua: calidad de codigo, comunicacion, toma de decisiones, no solo si "funciona"

Etapa 3 - System design / Arquitectura (para seniors):
- Presenta un problema real de tu empresa
- Evalua pensamiento a escala, trade-offs, experiencia con sistemas distribuidos
- No busques la respuesta "correcta", busca el proceso de razonamiento

4. CIERRE Y OFERTA

Factores que mas valoran los developers mexicanos (en orden):
1. Trabajo remoto / hibrido flexible
2. Compensacion competitiva (investigar rangos actuales)
3. Stack tecnologico moderno (nadie quiere mantener legacy en COBOL)
4. Cultura de ingenieria (code reviews, CI/CD, autonomia)
5. Crecimiento profesional (presupuesto de aprendizaje, conferencias)
6. Equity / ESOP (en startups)

Red flags que ahuyentan candidatos tech:
- Proceso de entrevista de 5+ rondas
- No revelar rango salarial hasta la oferta
- Pruebas tecnicas de 8+ horas
- "Somos como una familia"
- No tener presencia tech en redes (blog, GitHub, meetups)

5. METRICAS CLAVE

- Time to fill: Meta 30-45 dias para roles tech
- Pipeline-to-hire ratio: 50 sourced → 15 contactados → 8 interesados → 4 entrevistas → 2 finalistas → 1 hire
- Offer acceptance rate: Meta >80%
- Source effectiveness: Trackea de donde vienen tus mejores hires

================================================================
Generado por Enlace 468 | Recruiter Academy Pro`,
  },
  {
    id: 'headhunting-clevel',
    title: 'Headhunting C-Level',
    subtitle: 'Metodologia de busqueda ejecutiva para posiciones de alta direccion',
    icon: Crown,
    gradient: 'from-amber-500/20 to-yellow-500/10',
    iconColor: 'text-amber-400',
    preview: 'Proceso estructurado para identificar, abordar y cerrar directores, VPs y C-Level en el mercado mexicano y LATAM.',
    content: `PLAYBOOK: HEADHUNTING C-LEVEL
================================================================

1. DIFERENCIAS FUNDAMENTALES VS RECLUTAMIENTO OPERATIVO

El headhunting ejecutivo NO es reclutamiento con candidatos mas caros. Es un proceso completamente diferente:

- No hay candidatos "activos" buscando empleo. El 95% de ejecutivos C-Level estan empleados y no revisan bolsas de trabajo.
- El proceso es consultivo, no transaccional. Eres un asesor estrategico del consejo o CEO, no un "proveedor de CVs".
- La confidencialidad es critica. Muchas busquedas son confidenciales (reemplazo de ejecutivo actual, expansion no anunciada).
- El timeline es largo: 60-120 dias en promedio, no 30.

2. INTAKE MEETING CON EL CLIENTE

La reunion de briefing es el momento mas importante del proceso. Lo que debes obtener:

Informacion del negocio:
- Situacion actual de la empresa (crecimiento, reestructura, crisis, expansion)
- Estructura organizacional (a quien reporta, cuantos reportes directos)
- Cultura real (no la del sitio web, la que viven dia a dia)
- Retos estrategicos que enfrentara el ejecutivo en los primeros 12 meses
- Razon de la vacante (renuncia, despido, creacion, sucesion)

Perfil del ejecutivo ideal:
- Competencias criticas (maximo 3-4, no una lista de 20)
- Experiencia en industria (¿necesaria o deseable?)
- Tamano de empresa donde ha operado (no es lo mismo PYME que corporativo)
- Estilo de liderazgo requerido (builder vs optimizer, hands-on vs estrategico)
- Deal-breakers absolutas

Compensacion:
- Paquete total: base + bono + LTIP/equity + beneficios
- Benchmark del mercado vs lo que ofrece la empresa
- Flexibilidad real (¿hasta donde pueden estirar?)
- Relocation package si aplica

3. MAPEO DE MERCADO Y LONG LIST

Antes de contactar a nadie, haz un mapeo exhaustivo:

Fuentes para identificar ejecutivos:
a) LinkedIn (busqueda por titulo + empresa + industria)
b) Informes anuales y reportes de empresa (mencionan directores)
c) Prensa de negocios (Expansion, Forbes Mexico, El Economista)
d) Directorios de camaras de comercio e industria
e) Tu red personal y referencias cruzadas
f) Eventos de industria y conferencias (panelistas, speakers)

Long List: 30-50 nombres
- Incluye: nombre, empresa actual, titulo, trayectoria resumida, estimado de compensacion
- Clasifica en: A (perfil ideal), B (perfil interesante), C (stretch pero posible)

Short List presentada al cliente: 8-12 nombres
- Solo perfiles A y B+
- Incluye tu evaluacion inicial y razon de inclusion
- El cliente aprueba o ajusta antes de que contactes

4. APPROACH Y PRIMER CONTACTO

El approach es un arte. Nunca envies un InMail generico a un C-Level.

Canales por efectividad:
1. Referencia personal (alguien en comun hace la introduccion) - 70% tasa de respuesta
2. Llamada directa a su asistente ejecutiva - 40% tasa de acceso
3. LinkedIn con mensaje ultra personalizado - 25% tasa de respuesta
4. Email directo (si lo tienes) - 20%

Estructura del primer mensaje:
- NO menciones "tengo una oportunidad increible"
- SI menciona algo especifico de su trayectoria que te llamo la atencion
- Posicionate como asesor, no como vendedor
- Pide 20 minutos de su tiempo "para un intercambio de perspectivas sobre el mercado"
- Menciona (sin revelar el nombre del cliente) el tipo de organizacion y el reto estrategico

Ejemplo de approach:
"Buen dia, [Nombre]. He seguido el crecimiento que lideraste en [Empresa] durante los ultimos 3 anios — el resultado en [metrica publica] es notable. Estoy asesorando a una empresa lider en [industria] que enfrenta un reto estrategico interesante en [area] y me gustaria intercambiar perspectivas contigo. ¿Tendrias 20 minutos esta semana?"

5. ENTREVISTA EJECUTIVA Y EVALUACION

La entrevista C-Level no es una lista de preguntas. Es una conversacion estrategica:

Framework de evaluacion ejecutiva:
a) Track record: Resultados medibles en roles anteriores. No lo que "hizo", sino el impacto que genero.
b) Capacidad estrategica: ¿Puede ver el panorama completo? ¿Toma decisiones de largo plazo?
c) Liderazgo: ¿Ha construido equipos? ¿Lo siguen? Pide referencias especificas.
d) Fit cultural: ¿Funcionara en ESTA empresa especifica, con ESTE CEO, en ESTE momento?
e) Motivacion real: ¿Por que consideraria moverse? ¿Que lo motiva mas alla del dinero?

Preguntas clave:
- "¿Cual ha sido la decision mas dificil que has tomado como lider y que aprendiste?"
- "Si pudieras cambiar una cosa de tu rol actual, ¿cual seria?"
- "Describe un momento donde tu estrategia fallo. ¿Que hiciste?"
- "¿Como evaluas y desarrollas a tu equipo directivo?"

6. PRESENTACION DE CANDIDATOS Y CIERRE

Short list final: 3-5 candidatos
- Cada candidato con un Executive Brief de 2-3 paginas
- Incluye: trayectoria, logros clave, evaluacion de competencias, motivacion, compensacion actual, riesgos
- Presenta en persona o videollamada, nunca solo por email

Negociacion de oferta:
- Conoce las expectativas del candidato ANTES de que el cliente haga la oferta
- Asegura que no haya sorpresas en ningun lado
- El paquete total importa mas que el salario base
- Incluye: base, bono (STI), incentivo largo plazo (LTI), auto, seguro, presupuesto de desarrollo
- Acompana al candidato durante la renuncia (counteroffers son comunes en C-Level)

Onboarding ejecutivo:
- Haz seguimiento a los 30, 60 y 90 dias
- Un headhunter profesional se asegura de que la integracion sea exitosa
- Esto genera recompra y referidos

================================================================
Generado por Enlace 468 | Recruiter Academy Pro`,
  },
  {
    id: 'reclutamiento-masivo',
    title: 'Reclutamiento Masivo',
    subtitle: 'Estrategias para contratar alto volumen sin sacrificar calidad',
    icon: Users,
    gradient: 'from-emerald-500/20 to-green-500/10',
    iconColor: 'text-emerald-400',
    preview: 'Framework para procesos de contratacion de 50+ posiciones simultaneas en manufactura, retail, BPO y operaciones.',
    content: `PLAYBOOK: RECLUTAMIENTO MASIVO
================================================================

1. CUANDO APLICA EL RECLUTAMIENTO MASIVO

El reclutamiento masivo se activa cuando necesitas cubrir 50+ posiciones similares en un periodo corto (30-90 dias). Contextos tipicos en Mexico:

- Apertura de nueva planta de manufactura (100-500 operadores)
- Expansion de cadena retail (20-50 tiendas nuevas)
- Lanzamiento de centro de contacto / BPO (200+ agentes)
- Proyectos de nearshoring con ramp-up rapido
- Temporadas altas (Buen Fin, Navidad, regreso a clases)

Diferencias clave vs reclutamiento individual:
- Proceso estandarizado y repetible (no personalizado)
- Evaluacion por competencias minimas, no por "mejor candidato"
- Velocidad y volumen > profundidad de evaluacion
- Funnel de conversion es la metrica critica
- Automatizacion es obligatoria, no opcional

2. PLANIFICACION Y METRICAS

Antes de publicar una sola vacante, define:

Metricas del funnel (benchmark Mexico):
- Para cubrir 100 posiciones operativas necesitas:
  - 2,000-3,000 aplicaciones (o leads)
  - 800-1,200 candidatos contactados
  - 400-600 que asisten a filtro
  - 200-300 que pasan evaluacion
  - 120-150 ofertas
  - 100-110 ingresos efectivos (considerando un 10% de no-shows)

Timeline realista:
- Semana 1-2: Planificacion, publicacion masiva, activacion de canales
- Semana 3-6: Filtros masivos, evaluaciones, ofertas
- Semana 7-8: Ingresos escalonados y onboarding
- Semana 9-12: Estabilizacion y reemplazo de bajas tempranas

Presupuesto por canal (CPH - Costo por Hire):
- Bolsas de trabajo (OCC, Indeed, CompuTrabajo): $800-2,000 MXN por hire
- Redes sociales (Meta Ads): $500-1,500 MXN por hire
- Referidos internos: $300-800 MXN por hire (el mas barato y mejor)
- Ferias de empleo: $1,000-3,000 MXN por hire
- Agencias: $3,000-8,000 MXN por hire (usar como complemento)

3. CANALES DE ATRACCION MASIVA

Canal 1: Job boards con publicacion premium
- OCC Mundial (Mexico #1 para operativos)
- Indeed (alto volumen de aplicaciones)
- CompuTrabajo (bueno para manufactura y retail)
- Tip: Publica versiones ligeramente diferentes del mismo puesto para maximizar visibilidad

Canal 2: Redes sociales con pauta pagada
- Facebook/Meta Ads: El canal #1 para operativos en Mexico
- Targeting: Edad, ubicacion (radio de 15-30 km de la planta/tienda), intereses
- Formulario de registro directo en Facebook (Lead Form) — no mandes a un sitio externo
- WhatsApp Business: Configura un chatbot para pre-filtro automatico

Canal 3: Programa de referidos
- Ofrece bono de $500-2,000 MXN por referido contratado que dure 90 dias
- Los referidos tienen 40% menos rotacion que candidatos de bolsa de trabajo
- Haz campanas internas con leaderboards y premios adicionales

Canal 4: Alianzas comunitarias
- Juntas auxiliares y delegaciones municipales
- Iglesias y centros comunitarios
- Escuelas tecnicas (CONALEP, CECATI, universidades tecnologicas)
- DIF y programas gubernamentales de empleo

Canal 5: Ferias de empleo
- Organiza tu propia feria en la zona (mas efectivo que asistir a ferias generales)
- Lleva: aplicacion movil o tablets para registro, evaluadores en sitio, ofertas inmediatas
- Meta: 200+ registros por feria, 30-40% conversion a proceso

4. PROCESO DE SELECCION MASIVO

El proceso debe ser RAPIDO. Cada dia de demora pierdes candidatos.

Dia 0: Aplicacion
- Formulario corto (nombre, telefono, ubicacion, experiencia)
- Confirmacion automatica por WhatsApp
- NO pidas CV para posiciones operativas

Dia 1-2: Pre-filtro automatizado
- Llamada o WhatsApp de 5 minutos
- Valida: disponibilidad, ubicacion, expectativa salarial, documentos
- Descarta rapido: sin el perfil minimo, no avances

Dia 3-5: Evaluacion grupal
- Sesiones de 20-30 candidatos
- Dinamica de 2 horas maximo:
  - Presentacion de la empresa (20 min)
  - Evaluacion de competencias basicas (psicometricos breves, 30 min)
  - Entrevista grupal por competencias (30 min)
  - Evaluacion practica si aplica (30 min)
- Resultado el mismo dia

Dia 5-7: Oferta y documentacion
- Oferta verbal al terminar la evaluacion (mismo dia si es posible)
- Paquete de documentos minimo: INE, CURP, comprobante de domicilio, NSS
- Agenda examen medico inmediatamente

Dia 8-14: Ingreso
- Onboarding estandarizado de 1-3 dias
- Kit de bienvenida con informacion clave
- Asignar buddy/mentor para la primera semana

5. RETENCION TEMPRANA (PRIMEROS 90 DIAS)

El reclutamiento masivo no termina con el ingreso. La rotacion temprana puede destruir tu esfuerzo:

Benchmark de rotacion en Mexico:
- Manufactura: 5-8% mensual (primeros 3 meses)
- Retail: 8-12% mensual
- BPO/Call center: 10-15% mensual
- Operativos: 4-6% mensual

Estrategias de retencion:
a) Onboarding estructurado de 5 dias (no solo 1 dia de induccion)
b) Encuesta de satisfaccion a los 7, 30 y 60 dias
c) Programa de mentores/buddies para nuevos ingresos
d) Reconocimiento temprano (certificado de primer mes, pequenos bonos)
e) Canal abierto de comunicacion (buzon, WhatsApp, HR on-site)
f) Tracking de bajas con entrevista de salida para cada una

Si tu rotacion en 90 dias supera el 25%, el problema no es reclutamiento — es la operacion, el liderazgo directo o la compensacion.

================================================================
Generado por Enlace 468 | Recruiter Academy Pro`,
  },
  {
    id: 'onboarding-ia',
    title: 'Onboarding del Reclutador con IA',
    subtitle: 'Como integrar inteligencia artificial en tu operacion de reclutamiento',
    icon: Cpu,
    gradient: 'from-violet-500/20 to-purple-500/10',
    iconColor: 'text-violet-400',
    preview: 'Guia paso a paso para incorporar herramientas de IA en cada etapa del proceso de reclutamiento, desde sourcing hasta reportes.',
    content: `PLAYBOOK: ONBOARDING DEL RECLUTADOR CON IA
================================================================

1. POR DONDE EMPEZAR (SEMANA 1)

Si nunca has usado IA en reclutamiento, esta es tu hoja de ruta para las primeras 4 semanas.

Herramientas que necesitas (costo total: ~$500 MXN/mes):
- ChatGPT Plus ($20 USD/mes) o Claude Pro ($20 USD/mes)
- Cuenta gratuita de LinkedIn (para empezar)
- Google Docs / Notion (para documentar prompts y resultados)
- WhatsApp Business (gratis)

Semana 1: Fundamentos
Dia 1-2: Familiarizate con ChatGPT o Claude
- Crea una cuenta y explora la interfaz
- Prueba conversaciones simples: "Hola, soy reclutador en Mexico, ¿como puedes ayudarme?"
- Entiende que los LLMs son herramientas de texto — generan, analizan y transforman texto

Dia 3-4: Tu primer prompt de reclutamiento
- Prueba este prompt basico:
  "Genera 5 preguntas de entrevista conductual para un Gerente de Marketing Digital en una empresa fintech en Mexico. Usa el formato STAR."
- Observa la calidad de la respuesta. Luego mejora el prompt agregando contexto:
  - Agrega: "La empresa tiene 200 empleados, esta en serie B, y busca alguien que haya manejado equipos de 10+ personas"
- Compara ambas respuestas. Mas contexto = mejores resultados.

Dia 5: Crea tu primera busqueda booleana con IA
- Prompt: "Genera una busqueda booleana para LinkedIn para encontrar [puesto] en [ubicacion] con experiencia en [habilidades]. Incluye variaciones en espanol e ingles."
- Copia el resultado y usalo en LinkedIn. Evalua la calidad de los resultados.

2. AUTOMATIZA TU SOURCING (SEMANA 2)

Ahora que dominas los prompts basicos, aplica IA a tu flujo de sourcing diario.

Proceso de sourcing asistido por IA:

Paso 1: Recibe el brief de la vacante
Paso 2: Usa IA para generar el perfil ideal del candidato:
  Prompt: "Analiza este job description y genera: 1) Perfil ideal del candidato, 2) Titulos probables en LinkedIn, 3) Empresas target, 4) Busqueda booleana, 5) Criterios de descarte rapido. JD: [pega el JD]"

Paso 3: Ejecuta la busqueda en LinkedIn con los boolean strings generados
Paso 4: Para cada candidato interesante, usa IA para personalizar el outreach:
  Prompt: "Escribe un mensaje de primer contacto por LinkedIn para [nombre], que es [titulo] en [empresa]. La vacante es [puesto] en [tu empresa]. Menciona [algo especifico del perfil] y usa tono profesional pero cercano. Maximo 150 palabras."

Resultado esperado: Con este flujo, puedes contactar 20-30 candidatos personalizados por dia (vs 5-8 sin IA).

3. SCREENING INTELIGENTE (SEMANA 3)

El screening es donde la IA genera el mayor ahorro de tiempo.

Flujo de screening con IA:

Paso 1: Recibe CVs o perfiles de candidatos
Paso 2: Copia el texto del CV y usa este prompt:
  "Analiza este CV contra el siguiente job description. Evalua match (1-10), identifica fortalezas, red flags, gaps de experiencia, y genera 5 preguntas especificas para la entrevista. JD: [JD]. CV: [CV]"

Paso 3: Revisa el analisis de la IA. Usa tu criterio para validar o ajustar.
Paso 4: Para candidatos que pasan screening, genera preguntas de entrevista personalizadas:
  "Basado en este CV, genera 10 preguntas de entrevista que validen: [competencias clave]. Incluye preguntas STAR, tecnicas y de motivacion."

Importante: La IA es tu asistente, no tu reemplazo. Siempre revisa los CVs que la IA recomienda descartar — puede haber falsos negativos.

4. REPORTES Y DOCUMENTACION (SEMANA 4)

Usa IA para generar reportes profesionales en minutos en lugar de horas.

Reporte de pipeline:
  Prompt: "Genera un reporte ejecutivo del pipeline de la vacante [puesto]. Datos: [X] sourced, [X] contactados, [X] en entrevista, [X] finalistas. Incluye tasas de conversion, analisis del mercado y proximos pasos. Formato profesional para presentar a hiring manager."

Reporte de cierre:
  Prompt: "Redacta un reporte de cierre de vacante para [puesto]. Candidato seleccionado: [nombre]. Proceso de [X] dias. Incluye: resumen del proceso, pipeline, candidato seleccionado, observaciones del mercado y recomendaciones."

Job descriptions optimizados:
  Prompt: "Reescribe este job description para que sea mas atractivo e inclusivo. Mantiene los requisitos tecnicos pero mejora la narrativa. Incluye: proposito del rol, impacto esperado, beneficios. Industria: [industria]. Cultura: [descripcion breve de la cultura]. JD original: [pega JD]"

5. BUENAS PRACTICAS Y ETICA

Reglas de oro para usar IA en reclutamiento:

a) Privacidad de datos
- No subas datos personales sensibles (CURP, RFC, direcciones) a ChatGPT
- Si necesitas analizar CVs, anonimiza primero o usa herramientas con politicas de privacidad empresarial
- Cumple con la Ley Federal de Proteccion de Datos Personales (LFPDPPP)

b) Sesgo y equidad
- La IA puede perpetuar sesgos. Revisa que tus prompts no incluyan criterios discriminatorios
- No uses IA para filtrar por edad, genero, universidad o apariencia
- Documenta tus criterios de evaluacion para auditorias

c) Transparencia
- No es necesario decirle al candidato que usaste IA para escribir un mensaje (es una herramienta)
- Si es necesario informar si la IA TOMA decisiones de descarte automaticamente (en Mexico esto tiene implicaciones legales)

d) Calidad sobre velocidad
- La IA te da velocidad, pero tu aportas juicio y empatia
- Nunca envies un mensaje generado por IA sin leerlo primero
- Personaliza siempre: los candidatos detectan mensajes genericos

e) Mejora continua
- Guarda tus mejores prompts en un documento maestro
- Itera: si un prompt no da buenos resultados, ajustalo
- Comparte con tu equipo: los prompts son conocimiento compartido

6. STACK TECNOLOGICO RECOMENDADO

Para el reclutador moderno en Mexico:

Basico (Gratis - $500 MXN/mes):
- ChatGPT Free o Claude Free (con limites)
- LinkedIn Free
- Google Workspace
- WhatsApp Business

Intermedio ($500 - $2,000 MXN/mes):
- ChatGPT Plus o Claude Pro
- LinkedIn Recruiter Lite
- Notion AI
- Loom (videos de comunicacion)

Avanzado ($2,000+ MXN/mes):
- ChatGPT Team o Claude Enterprise
- LinkedIn Recruiter Full
- ATS (Greenhouse, Lever, Workable)
- Herramientas de automatizacion (Zapier, Make)

================================================================
Generado por Enlace 468 | Recruiter Academy Pro`,
  },
]

/* ───────── MAIN COMPONENT ───────── */

export default function PlaybooksPage() {
  const { canDo } = usePlan()
  const [selectedPlaybook, setSelectedPlaybook] = useState(null)
  const [copied, setCopied] = useState(false)

  if (!canDo('access_academy')) {
    return <UpgradePrompt action="access_academy" />
  }

  const handleCopy = () => {
    if (!selectedPlaybook) return
    navigator.clipboard.writeText(selectedPlaybook.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    if (!selectedPlaybook) return
    const blob = new Blob([selectedPlaybook.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `playbook-${selectedPlaybook.id}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (selectedPlaybook) {
    return (
      <div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <button onClick={() => { setSelectedPlaybook(null); setCopied(false) }}
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
              <ArrowLeft size={16} /> Volver a Playbooks
            </button>
            <div className="flex items-center gap-2">
              <button onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary-light rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
                {copied ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar al portapapeles</>}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="glass rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${selectedPlaybook.gradient} flex items-center justify-center ${selectedPlaybook.iconColor}`}>
                <selectedPlaybook.icon size={24} />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-white">{selectedPlaybook.title}</h1>
                <p className="text-sm text-gray-400">{selectedPlaybook.subtitle}</p>
              </div>
            </div>

            {/* Render content as formatted text */}
            <div className="bg-black/30 rounded-xl p-6 border border-white/10">
              <pre className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-sans">
                {selectedPlaybook.content}
              </pre>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Link to="/dashboard/academy" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-4">
          <ChevronLeft size={16} /> Academy
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center">
            <BookOpen size={20} className="text-violet-400" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Playbooks Ejecutivos</h1>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500/10 text-purple-400">Pro</span>
        </div>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Guias ejecutivas paso a paso para los escenarios de reclutamiento mas comunes. Contenido actionable y especifico para el mercado mexicano.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {PLAYBOOKS.map((pb, i) => {
          const Icon = pb.icon
          return (
            <motion.div
              key={pb.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="glass rounded-xl p-6 flex flex-col cursor-pointer group"
              onClick={() => setSelectedPlaybook(pb)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pb.gradient} flex items-center justify-center ${pb.iconColor} group-hover:scale-110 transition-transform`}>
                  <Icon size={24} />
                </div>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border bg-purple-500/20 text-purple-400 border-purple-500/30">
                  Playbook
                </span>
              </div>

              <h2 className="text-lg font-display font-bold text-white mb-1 group-hover:text-primary-light transition-colors">{pb.title}</h2>
              <p className="text-xs text-gray-500 mb-3">{pb.subtitle}</p>
              <p className="text-sm text-gray-400 mb-5 leading-relaxed flex-1">{pb.preview}</p>

              <div className="flex items-center gap-2 text-sm font-semibold text-primary-light group-hover:gap-3 transition-all pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                Leer playbook completo
                <ArrowRight size={16} />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
