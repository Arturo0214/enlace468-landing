import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, ChevronDown, BookOpen } from 'lucide-react'

const guides = [
  {
    title: 'Boolean Search para LinkedIn',
    tag: 'LinkedIn',
    content: {
      intro: 'La busqueda booleana es la herramienta mas poderosa para filtrar candidatos en LinkedIn. Dominar estos operadores te permite encontrar perfiles ultra-especificos en segundos, reduciendo el ruido y ahorrando horas de busqueda manual.',
      sections: [
        {
          subtitle: 'Operadores basicos',
          text: 'LinkedIn soporta tres operadores principales: AND (ambos terminos), OR (cualquiera de los terminos) y NOT (excluir termino). Usa comillas para frases exactas y parentesis para agrupar.',
          bullets: [
            '"product manager" AND (fintech OR "servicios financieros")',
            '"desarrollador" AND (React OR Angular) NOT junior',
            '("gerente de ventas" OR "director comercial") AND CDMX',
            '"data engineer" AND (Python OR Scala) AND (Spark OR Databricks)',
          ],
        },
        {
          subtitle: 'Estrategias avanzadas',
          text: 'Combina operadores con filtros de LinkedIn para busquedas de precision. Utiliza variaciones de titulo en espanol e ingles para capturar mas resultados.',
          bullets: [
            'Usa OR para variaciones: "contador" OR "accountant" OR "contabilidad"',
            'Excluye niveles no deseados: NOT (intern OR becario OR practicante)',
            'Busca por herramientas especificas: "SAP" AND ("FI" OR "CO" OR "MM")',
            'Combina con filtros de ubicacion y empresa para mayor precision',
          ],
        },
      ],
    },
  },
  {
    title: 'X-Ray Search con Google',
    tag: 'Google',
    content: {
      intro: 'La busqueda X-Ray te permite encontrar perfiles de LinkedIn que no aparecen en la busqueda nativa de la plataforma. Usando operadores de Google, puedes acceder a perfiles publicos sin necesidad de una cuenta premium, lo que amplifica enormemente tu alcance de sourcing.',
      sections: [
        {
          subtitle: 'Busquedas basicas con site:',
          text: 'El operador site: limita los resultados a un dominio especifico. Combinalo con palabras clave para encontrar perfiles de LinkedIn directamente desde Google.',
          bullets: [
            'site:linkedin.com/in "product manager" "Ciudad de Mexico"',
            'site:linkedin.com/in "desarrollador" (React OR Angular) Mexico',
            'site:linkedin.com/in intitle:"gerente de ventas" "industria automotriz"',
            'site:linkedin.com/in "data scientist" (Python OR R) "Monterrey"',
          ],
        },
        {
          subtitle: 'Tecnicas avanzadas',
          text: 'Usa operadores adicionales de Google como intitle:, inurl: y el operador de rango (..) para refinar aun mas tus resultados.',
          bullets: [
            'site:linkedin.com/in "machine learning" -jobs -posts (excluye paginas de empleo)',
            'site:linkedin.com/in "CFO" OR "Chief Financial Officer" Mexico -recruiter',
            'Busca en GitHub para perfiles tecnicos: site:github.com "Mexico" "react" "contributions"',
            'Combina sitios: (site:linkedin.com/in OR site:github.com) "kubernetes" Mexico',
          ],
        },
      ],
    },
  },
  {
    title: 'Sourcing en OCC Mundial',
    tag: 'OCC',
    content: {
      intro: 'OCC Mundial es la bolsa de trabajo mas grande de Mexico y una fuente invaluable de candidatos activos. Aunque muchos reclutadores la usan solo para publicar vacantes, tiene funcionalidades de busqueda de CV que permiten identificar candidatos de forma proactiva.',
      sections: [
        {
          subtitle: 'Filtros clave para buscar candidatos',
          text: 'Aprovecha los filtros avanzados de la plataforma para hacer busquedas eficientes. La clave esta en combinar multiples filtros para obtener resultados relevantes.',
          bullets: [
            'Usa el filtro de "Ultima actualizacion" para encontrar candidatos activos (menos de 30 dias)',
            'Filtra por rango salarial esperado para alinear con tu presupuesto desde el inicio',
            'Utiliza palabras clave del sector, no solo del puesto (Ej: "SAP FICO" en lugar de solo "Contador")',
            'Revisa candidatos en ubicaciones cercanas que podrian reubicarse',
          ],
        },
        {
          subtitle: 'Tips para mejor conversion',
          text: 'No basta con encontrar candidatos; la forma en que los contactas en OCC determina tu tasa de respuesta.',
          bullets: [
            'Contacta dentro de las primeras 48 horas de que el candidato actualizo su perfil',
            'Personaliza el asunto del mensaje: evita "Oportunidad laboral" generico',
            'Incluye rango salarial y ubicacion en el primer mensaje para filtrar rapido',
            'Descarga CVs de candidatos prometedores antes de que cambien de estatus',
          ],
        },
      ],
    },
  },
  {
    title: 'Busqueda por competencias',
    tag: 'Skills',
    content: {
      intro: 'Buscar por competencias en lugar de por titulo de puesto te permite encontrar candidatos que otros reclutadores no ven. Muchos profesionales tienen las habilidades que necesitas pero con titulos diferentes, especialmente en mercados como el mexicano donde los titulos varian mucho entre empresas.',
      sections: [
        {
          subtitle: 'Mapeo de competencias a terminos de busqueda',
          text: 'Antes de buscar, crea un mapa de las competencias del puesto y sus equivalentes en diferentes industrias, idiomas y niveles.',
          bullets: [
            'Liderazgo: "gestion de equipos" OR "people management" OR "lider de" OR "coordinador"',
            'Ventas B2B: "desarrollo de negocios" OR "business development" OR "key account" OR "enterprise sales"',
            'Analisis de datos: "data analysis" OR "business intelligence" OR "BI" OR "Power BI" OR "Tableau"',
            'Gestion de proyectos: "project management" OR "PMP" OR "Scrum Master" OR "PMO" OR "gestion de proyectos"',
          ],
        },
        {
          subtitle: 'Framework de busqueda por niveles',
          text: 'Adapta tus terminos segun el nivel de senioridad que necesitas para evitar perfiles demasiado junior o senior.',
          bullets: [
            'Junior (0-3 anios): analista, coordinador, ejecutivo, asistente, trainee',
            'Mid (3-7 anios): especialista, lider, senior, responsable, encargado',
            'Senior (7-12 anios): gerente, manager, subdirector, head of, jefe de',
            'Ejecutivo (12+ anios): director, VP, C-level, country manager, socio',
          ],
        },
      ],
    },
  },
  {
    title: 'Sourcing pasivo - Candidatos que no buscan empleo',
    tag: 'Estrategia',
    content: {
      intro: 'Los mejores candidatos generalmente no estan buscando trabajo activamente. El 70% del talento en Mexico es "pasivo" - estan empleados y satisfechos, pero abiertos a escuchar propuestas interesantes. Llegar a estos candidatos requiere estrategias diferentes a las tradicionales.',
      sections: [
        {
          subtitle: 'Donde encontrar talento pasivo',
          text: 'Los candidatos pasivos no estan en bolsas de trabajo, pero si dejan huella digital en otros espacios profesionales.',
          bullets: [
            'LinkedIn: busca personas que publican contenido o comentan en posts de su industria',
            'GitHub/Stack Overflow: para perfiles tecnicos, busca contribuidores activos en proyectos relevantes',
            'Eventos y conferencias: asiste a meetups de la industria (presenciales y virtuales)',
            'Publicaciones y premios: busca autores de articulos en medios de la industria',
            'Asociaciones profesionales: AMEDIRH, IMEF, COPARMEX tienen directorios de miembros',
          ],
        },
        {
          subtitle: 'Como abordar al candidato pasivo',
          text: 'El mensaje debe ser diferente al que usarias con un candidato activo. No estas ofreciendo un empleo, estas abriendo una conversacion.',
          bullets: [
            'Nunca abras con "tengo una vacante" - en su lugar, comenta algo de su trabajo o publicaciones',
            'Genera curiosidad: "Me gustaria tu opinion experta sobre un proyecto en el que estoy trabajando"',
            'Ofrece valor primero: comparte un articulo, dato de mercado o insight relevante para ellos',
            'Se paciente: el ciclo de conversion de un candidato pasivo puede ser de 2 a 8 semanas',
          ],
        },
      ],
    },
  },
]

export default function SearchGuides() {
  const [openIdx, setOpenIdx] = useState(null)

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
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold/20 to-primary/10 flex items-center justify-center">
            <Search size={20} className="text-gold" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white">Guias de Busqueda</h1>
        </div>
        <p className="text-gray-400 mt-1 max-w-2xl">
          Estrategias probadas, boolean strings y tecnicas avanzadas de sourcing para encontrar al candidato ideal.
        </p>
      </motion.div>

      <div className="space-y-3">
        {guides.map((guide, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06 }}
          >
            <div className="glass rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="w-full flex items-center justify-between px-5 py-4 text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                    <BookOpen size={16} className="text-gold" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-primary-light transition-colors">
                      {guide.title}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-500 bg-white/5 px-2.5 py-1 rounded-full">
                    {guide.tag}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 transition-transform ${openIdx === idx ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              <AnimatePresence>
                {openIdx === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 border-t border-white/5 pt-4">
                      <p className="text-sm text-gray-300 leading-relaxed mb-5">
                        {guide.content.intro}
                      </p>
                      {guide.content.sections.map((section, si) => (
                        <div key={si} className="mb-5 last:mb-0">
                          <h4 className="text-sm font-semibold text-white mb-2">{section.subtitle}</h4>
                          <p className="text-sm text-gray-400 leading-relaxed mb-3">{section.text}</p>
                          <div className="space-y-2">
                            {section.bullets.map((bullet, bi) => (
                              <div key={bi} className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary-light/60 mt-1.5 flex-shrink-0" />
                                <code className="text-xs text-gray-300 bg-white/5 px-2 py-1 rounded border border-white/10 leading-relaxed block w-full">
                                  {bullet}
                                </code>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
