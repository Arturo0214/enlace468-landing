import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ChevronLeft, Award, ChevronDown, ChevronUp, CheckCircle,
  Users, Calendar, Clock, ArrowRight, Lightbulb, Target,
  MessageSquare, Handshake, Rocket, BarChart3
} from 'lucide-react'

/* ═══════════════════════════════════════════════════
   BEST PRACTICES DATA
   ═══════════════════════════════════════════════════ */

const PRACTICES = [
  {
    id: 'intake-perfecto',
    icon: Target,
    gradient: 'from-blue-500/20 to-cyan-500/10',
    iconColor: 'text-blue-400',
    title: 'Intake perfecto en 30 minutos',
    summary: 'Domina la reunion de levantamiento de perfil para arrancar cada vacante con claridad total.',
    content: {
      intro: 'El intake meeting es la reunion mas importante del proceso de reclutamiento. Un intake mal hecho genera candidatos que no cumplen, retrabajo, y frustracion con el hiring manager. Con esta metodologia, en 30 minutos tendras toda la informacion necesaria para reclutar con precision.',
      checklist: [
        'Confirmar titulo del puesto y nivel jerarquico real (no solo el titulo formal)',
        'Definir los 3 "must-have" no negociables vs los "nice-to-have"',
        'Preguntar: "Describe al mejor empleado que has tenido en este puesto, que lo hacia diferente?"',
        'Establecer rango salarial con flexibilidad y compensacion total (bonos, prestaciones)',
        'Definir el proceso de entrevistas: cuantas rondas, quien participa, duracion',
        'Acordar timeline y frecuencia de actualizaciones (semanal recomendado)',
        'Obtener nombres de 2-3 empresas donde podria estar el candidato ideal',
        'Preguntar sobre la cultura del equipo y estilo de liderazgo del jefe directo',
      ],
      tips: [
        'Nunca aceptes un JD generico de RH como unico brief. Habla directamente con el hiring manager.',
        'Si el hiring manager no puede articular que hace diferente al mejor empleado del area, probablemente no tiene claro el perfil. Ayudalo a construirlo.',
        'Envia un resumen por escrito del intake al hiring manager dentro de 24 horas y pide confirmacion. Esto evita malentendidos.',
        'En el mercado mexicano, es comun que el rango salarial no este definido. Lleva benchmarks de CompensaLab o Glassdoor para anclar la conversacion.',
        'Establece un SLA mutuo: tu te comprometes a presentar terna en X dias, pero necesitas retroalimentacion de candidatos en 48 horas maximo.',
      ],
    },
  },
  {
    id: 'sourcing-pasivo',
    icon: Lightbulb,
    gradient: 'from-violet-500/20 to-purple-500/10',
    iconColor: 'text-violet-400',
    title: 'Sourcing pasivo: como atraer a quien no busca empleo',
    summary: 'Estrategias probadas para conectar con candidatos que no estan en el mercado laboral activo.',
    content: {
      intro: 'El 70% del talento calificado en Mexico no esta buscando empleo activamente. Los mejores candidatos rara vez aplican a bolsas de trabajo. Dominar el sourcing pasivo es lo que separa a un recruiter promedio de uno excepcional. Aqui presentamos un framework que funciona consistentemente en el mercado mexicano.',
      checklist: [
        'Construye tu perfil de LinkedIn como "consultor de talento", no como "reclutador buscando candidatos"',
        'Publica contenido de valor sobre la industria 2-3 veces por semana antes de hacer outreach',
        'Usa X-ray search en Google: site:linkedin.com/in "titulo" "empresa" "ciudad"',
        'Busca en comunidades especificas: GitHub para tech, Behance para diseño, Medium para content',
        'Asiste a meetups y eventos de industria (en CDMX: Startup Grind, Product Tank, DevNights)',
        'Cultiva relaciones con "conectores" en cada industria que te refieran candidatos',
        'Crea un pipeline de candidatos pasivos que nutres con contenido cada 2-3 meses',
        'Usa InMail con personalizacion real: menciona un proyecto, publicacion o logro especifico',
      ],
      tips: [
        'El primer mensaje NUNCA debe mencionar una vacante. Inicia con algo sobre su trabajo que genuinamente te llamo la atencion.',
        'Los candidatos pasivos en Mexico responden mejor a WhatsApp que a InMail (tasa de respuesta 3x mayor), pero solo despues del primer contacto en LinkedIn.',
        'Crea alertas en LinkedIn Sales Navigator para monitorear cambios de puesto en empresas target: los primeros 3 meses en un nuevo empleo son el peor momento para contactar, los 12-18 meses son el ideal.',
        'En el mercado tech mexicano, compartir oportunidades en canales de Slack como "Tech MX" o "Devs MX" funciona mejor que LinkedIn para perfiles junior-mid.',
        'La tecnica "double opt-in" funciona bien: pide a un contacto en comun que te presente antes de contactar directamente. En la cultura mexicana, la recomendacion personal tiene mucho peso.',
      ],
    },
  },
  {
    id: 'screening-sin-sesgo',
    icon: CheckCircle,
    gradient: 'from-green-500/20 to-emerald-500/10',
    iconColor: 'text-green-400',
    title: 'Screening sin sesgo: framework STAR objetivo',
    summary: 'Evalua candidatos con criterios estructurados para eliminar sesgos inconscientes del proceso.',
    content: {
      intro: 'Los sesgos cognitivos en reclutamiento cuestan caro: el sesgo de afinidad ("me cae bien"), el efecto halo ("tiene buena universidad"), y el sesgo de confirmacion ("busco evidencia de lo que ya creo") son los mas comunes en Mexico. Este framework te ayuda a evaluar objetivamente usando la metodologia STAR adaptada al contexto mexicano.',
      checklist: [
        'Define 4-5 competencias clave ANTES de iniciar entrevistas (no durante)',
        'Crea preguntas conductuales estandarizadas para todos los candidatos del mismo puesto',
        'Usa scorecard numerica 1-5 con descriptores claros por nivel (no solo "bueno/malo")',
        'Evalua respuestas STAR: Situacion especifica + Tarea asignada + Accion tomada + Resultado medible',
        'No evalues la presentacion del candidato (vestimenta, acento) sino la sustancia de sus respuestas',
        'Toma notas textuales durante la entrevista, no interpretaciones ("dijo X" vs "creo que es inseguro")',
        'Espera al menos 30 minutos despues de la entrevista para evaluar (evita decisiones en caliente)',
        'Si tienes panel de entrevistadores, cada uno evalua independientemente antes de discutir',
      ],
      tips: [
        'El sesgo de "university brand" es fuerte en Mexico: un candidato del ITESM o IBERO no es automaticamente mejor. Enfocate en logros demostrables.',
        'Pregunta "Cuentame de una vez que fallaste en un proyecto y que aprendiste" - la capacidad de autoevaluacion es mejor predictor que los éxitos.',
        'Si un candidato no puede dar ejemplos especificos con numeros, es probable que este exagerando su participacion en el logro.',
        'Cuidado con el sesgo de genero en puestos de liderazgo: en Mexico, las mujeres tienden a subestimar sus logros y los hombres a sobreestimarlos. Busca evidencia concreta, no confianza verbal.',
        'Calibra regularmente con tu equipo: hagan ejercicios de evaluacion con los mismos CVs para asegurar que aplican los mismos criterios.',
      ],
    },
  },
  {
    id: 'negociacion-oferta',
    icon: Handshake,
    gradient: 'from-amber-500/20 to-orange-500/10',
    iconColor: 'text-amber-400',
    title: 'Negociacion de oferta: win-win approach',
    summary: 'Cierra ofertas exitosamente manteniendo al candidato motivado y al cliente dentro de presupuesto.',
    content: {
      intro: 'La negociacion de oferta es donde mas vacantes se pierden. En Mexico, el 35% de los candidatos rechazan la primera oferta y el 15% hace ghosting despues de recibir oferta. El enfoque win-win no es solo etico, es estrategico: un candidato que siente que negocio justamente llega mas motivado y se queda mas tiempo.',
      checklist: [
        'Investiga la expectativa salarial REAL desde la primera llamada (no esperes a la oferta)',
        'Conoce el paquete completo actual del candidato: sueldo base + bonos + prestaciones + vales',
        'Ten claros los limites del presupuesto ANTES de iniciar negociacion',
        'Prepara un paquete B y C alternativos por si el salario base no es suficiente',
        'Presenta la oferta verbalmente primero para medir reaccion antes de enviar carta',
        'Da al candidato 48-72 horas para decidir (no presiones con "oferta valida 24 horas")',
        'Si hay contraoferta de su empresa actual, enfocate en razones de cambio no monetarias',
        'Documenta todo por escrito: lo que se dijo verbalmente debe reflejarse en la carta oferta',
      ],
      tips: [
        'En Mexico, muchos candidatos piden "sueldo neto" pero las empresas ofrecen "bruto". SIEMPRE aclara si estan hablando neto o bruto desde el inicio.',
        'Las prestaciones superiores a la ley (seguro gastos medicos mayores, vales de despensa, fondo de ahorro) pueden representar hasta un 30% adicional al sueldo y son fiscalmente eficientes.',
        'Cuando un candidato tiene contraoferta, recuerdale que las razones por las que queria cambiar siguen ahi. El 80% de quienes aceptan contraoferta dejan la empresa en 12 meses.',
        'La flexibilidad (home office, horario flexible) es el beneficio mas valorado en Mexico post-pandemia, por encima de aumentos del 5-10%.',
        'Nunca hagas una oferta verbal que no puedas respaldar por escrito. En el mercado mexicano, la confianza del recruiter es tu activo mas valioso.',
      ],
    },
  },
  {
    id: 'onboarding-candidato',
    icon: Rocket,
    gradient: 'from-cyan-500/20 to-blue-500/10',
    iconColor: 'text-cyan-400',
    title: 'Onboarding del candidato: los primeros 90 dias',
    summary: 'Asegura la retencion del nuevo hire con seguimiento estructurado en el periodo critico.',
    content: {
      intro: 'El trabajo del recruiter no termina con la contratacion. El 20% de la rotacion en Mexico ocurre en los primeros 90 dias. Como recruiter, tienes la responsabilidad de hacer follow-up con el candidato que colocaste para asegurar una integracion exitosa. Esto ademas fortalece tu reputacion con el hiring manager y genera referidos.',
      checklist: [
        'Envia mensaje de felicitacion y bienvenida la noche anterior al primer dia',
        'Verifica que el workspace, equipo y accesos esten listos antes de su llegada',
        'Programa check-in con el candidato al dia 7: como se siente, que le sorprendio',
        'Programa check-in al dia 30: como va la curva de aprendizaje, necesita algo',
        'Programa check-in al dia 60: esta cumpliendo expectativas, tiene feedback',
        'Programa check-in al dia 90: evaluacion formal, plan de desarrollo',
        'Habla con el hiring manager en los dias 15, 45 y 90 para obtener su perspectiva',
        'Documenta aprendizajes para mejorar futuros procesos del mismo perfil',
      ],
      tips: [
        'El check-in del dia 7 es crucial: si el candidato tiene una mala primera semana y no lo detectas, es probable que empiece a buscar de nuevo silenciosamente.',
        'En empresas mexicanas, es comun que el onboarding formal sea debil. Ofrece al hiring manager un template de plan de 30-60-90 dias como valor agregado de tu servicio.',
        'Si detectas señales de alerta (candidato desmotivado, mala relacion con jefe), actua rapido: habla con ambas partes y facilita una conversacion antes de que escale.',
        'Pide referidos al candidato contratado en el check-in del dia 30. En ese punto esta lo suficientemente contento y conectado como para recomendar amigos y colegas.',
        'Mide tu tasa de retencion a 90 dias y 12 meses. Un recruiter excepcional tiene 90%+ de retencion a 90 dias. Esta metrica vale mas que el time-to-fill.',
      ],
    },
  },
  {
    id: 'metricas-direccion',
    icon: BarChart3,
    gradient: 'from-rose-500/20 to-pink-500/10',
    iconColor: 'text-rose-400',
    title: 'Metricas que convencen a la direccion',
    summary: 'Transforma datos de reclutamiento en narrativas que demuestran impacto de negocio.',
    content: {
      intro: 'Los directivos no quieren saber cuantas entrevistas hiciste. Quieren saber cuanto dinero ahorraste, cuanto tiempo redujiste, y como impactaste en la productividad. Aprender a traducir metricas operativas de reclutamiento a lenguaje de negocio es lo que convierte al recruiter en un socio estrategico de la direccion.',
      checklist: [
        'Calcula el costo por contratacion total: publicaciones + herramientas + horas-recruiter + agencias',
        'Mide time-to-fill Y time-to-productivity (no es lo mismo contratar rapido que integrar rapido)',
        'Registra la fuente de cada candidato contratado para calcular ROI por canal',
        'Mide quality of hire: desempeno del contratado en evaluacion a 6 meses vs promedio del equipo',
        'Calcula el costo de vacante abierta: productividad perdida por dia sin cubrir el puesto',
        'Compara metricas mes a mes para mostrar tendencia y mejora continua',
        'Presenta datos en formato ejecutivo: 1 pagina, 5 KPIs, 3 insights accionables',
        'Incluye siempre una recomendacion concreta: "Para reducir X, sugiero Y"',
      ],
      tips: [
        'La metrica que mas impacta a un director es el costo de vacante abierta. Para un puesto de $50K MXN/mes, cada dia sin cubrir cuesta aproximadamente $2,500 MXN en productividad perdida.',
        'Presenta datos comparativos: "Nuestro time-to-fill es 22 dias vs 35 dias de benchmark de la industria en Mexico" es mas poderoso que solo decir "22 dias".',
        'Usa el framework ROI: "Invertimos $15K en LinkedIn Recruiter. Contratamos 8 personas. Costo por contratacion: $1,875. Sin LinkedIn, usariamos agencia a $35K por contratacion. Ahorro: $264K anuales."',
        'Los directivos mexicanos responden bien a comparativos con la competencia. Si tienes datos de Mercer, ManpowerGroup o CompensaLab, usalos como benchmark.',
        'Nunca presentes metricas sin contexto. Un time-to-fill de 45 dias es excelente para un Director General pero pesimo para un Analista Jr.',
      ],
    },
  },
]

/* ═══════════════════════════════════════════════════
   UPCOMING SESSION (mock)
   ═══════════════════════════════════════════════════ */

const UPCOMING_SESSION = {
  title: 'Sourcing en la era de la IA: herramientas y estrategias 2026',
  date: '12 de junio, 2026',
  time: '18:00 - 19:30 (hora CDMX)',
  host: 'Enlace 468 Academy',
  spots: 15,
  maxSpots: 30,
}

/* ═══════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════ */

export default function BestPractices() {
  const [expandedCard, setExpandedCard] = useState(null)
  const [registered, setRegistered] = useState(false)

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Link to="/dashboard/recruiter-tools" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors">
          <ChevronLeft size={16} /> Recruiter Pro Tools
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center">
            <Award size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white">Mejores Practicas de Reclutamiento</h1>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Elite
            </span>
          </div>
        </div>
        <p className="text-gray-400 text-sm mt-2">
          Frameworks, checklists y estrategias comprobadas para cada etapa del ciclo de reclutamiento.
        </p>
      </motion.div>

      {/* Practice Cards */}
      <div className="space-y-4 mb-10">
        {PRACTICES.map((practice, i) => {
          const Icon = practice.icon
          const isExpanded = expandedCard === practice.id
          return (
            <motion.div
              key={practice.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass rounded-xl overflow-hidden"
            >
              {/* Card Header */}
              <button
                onClick={() => setExpandedCard(isExpanded ? null : practice.id)}
                className="w-full p-5 text-left flex items-start gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${practice.gradient} flex items-center justify-center ${practice.iconColor} flex-shrink-0`}>
                  <Icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white mb-1">{practice.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{practice.summary}</p>
                </div>
                {isExpanded
                  ? <ChevronUp size={16} className="text-gray-500 mt-1 flex-shrink-0" />
                  : <ChevronDown size={16} className="text-gray-500 mt-1 flex-shrink-0" />
                }
              </button>

              {/* Expanded Content */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      {/* Intro */}
                      <div className="pt-4">
                        <p className="text-sm text-gray-300 leading-relaxed">{practice.content.intro}</p>
                      </div>

                      {/* Checklist */}
                      <div>
                        <h4 className="text-xs font-semibold text-primary-light uppercase tracking-wider mb-3">Checklist</h4>
                        <div className="space-y-2">
                          {practice.content.checklist.map((item, ci) => (
                            <div key={ci} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-white/[0.02]">
                              <CheckCircle size={14} className="text-primary-light mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-gray-300 leading-relaxed">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Tips */}
                      <div>
                        <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">Tips avanzados</h4>
                        <div className="space-y-2">
                          {practice.content.tips.map((tip, ti) => (
                            <div key={ti} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-500/[0.03] border border-amber-500/10">
                              <Lightbulb size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-gray-300 leading-relaxed">{tip}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Sesiones Grupales */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass rounded-xl p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <Users size={18} className="text-violet-400" />
          <h2 className="text-lg font-display font-semibold text-white">Sesiones grupales mensuales</h2>
        </div>
        <div className="flex flex-col md:flex-row items-start gap-6 p-5 rounded-lg bg-gradient-to-r from-violet-500/5 to-primary/5 border border-violet-500/10">
          <div className="flex-1">
            <p className="text-xs text-violet-400 font-semibold uppercase tracking-wider mb-2">Proxima sesion</p>
            <h3 className="text-base font-semibold text-white mb-3">{UPCOMING_SESSION.title}</h3>
            <div className="flex flex-wrap gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar size={12} className="text-gray-500" />
                {UPCOMING_SESSION.date}
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} className="text-gray-500" />
                {UPCOMING_SESSION.time}
              </span>
              <span className="flex items-center gap-1">
                <Users size={12} className="text-gray-500" />
                {UPCOMING_SESSION.spots}/{UPCOMING_SESSION.maxSpots} lugares disponibles
              </span>
            </div>
          </div>
          <button
            onClick={() => setRegistered(true)}
            disabled={registered}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 flex-shrink-0 ${
              registered
                ? 'bg-green-500/20 text-green-400 cursor-default'
                : 'bg-primary text-white hover:bg-primary-light'
            }`}
          >
            {registered ? (
              <>
                <CheckCircle size={16} />
                Registrado
              </>
            ) : (
              <>
                Registrarse
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
