import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Copy, Check, BookOpen, FileText, Download, Video,
  Lock, ClipboardCopy, Star
} from 'lucide-react'
import { useAuth } from '../../lib/auth'

/* ─────────────────────────── RESOURCE CONTENT ─────────────────────────── */

const RESOURCES = {
  /* ──── FREE ──── */
  'intro-reclutamiento-ia': {
    title: 'Introduccion al Reclutamiento con IA',
    type: 'article',
    plan: 'free',
    content: `
## Por que importa la IA en reclutamiento

La inteligencia artificial no reemplaza al reclutador: lo potencia. Las empresas que adoptan herramientas de IA en sus procesos de talent acquisition reportan:

- **40% menos tiempo** en screening de CVs
- **3x mas candidatos contactados** por semana
- **Mejor calidad de shortlists** gracias a matching semantico

## Aplicaciones inmediatas

### 1. Sourcing inteligente
Herramientas como LinkedIn Recruiter + ChatGPT permiten generar busquedas booleanas complejas en segundos. En lugar de pasar 30 minutos construyendo un string, describes el perfil ideal en lenguaje natural y la IA genera la query.

### 2. Screening automatizado
Con prompts bien disenados, puedes pedirle a un LLM que analice un CV contra un job description y te entregue:
- Porcentaje de match
- Fortalezas del candidato
- Red flags o gaps de experiencia
- Preguntas sugeridas para la entrevista

### 3. Redaccion de mensajes de outreach
La personalizacion masiva es posible. Alimenta el perfil del candidato y el contexto de la vacante, y obtendras mensajes que se sienten escritos a mano.

### 4. Entrevistas estructuradas
Genera scorecards, preguntas por competencia y criterios de evaluacion estandarizados para cada posicion.

## Herramientas recomendadas para empezar

| Herramienta | Uso principal | Costo |
|-------------|---------------|-------|
| ChatGPT / Claude | Prompts de sourcing y screening | Free / $20 USD/mes |
| LinkedIn Recruiter Lite | Sourcing directo | ~$1,680 MXN/mes |
| Notion AI | Documentacion y reportes | $10 USD/mes |
| Loom | Comunicacion async con hiring managers | Free |

## Siguiente paso

Explora los **Prompts para sourcing en LinkedIn** en la seccion Founder para poner esto en practica hoy mismo.
    `,
  },
  'newsletter-talent-acquisition': {
    title: 'Newsletter: Tendencias en Talent Acquisition',
    type: 'article',
    plan: 'free',
    content: `
## Tendencias 2025-2026 en Talent Acquisition

### 1. Skills-based hiring
Las empresas estan dejando de filtrar por titulo universitario y priorizando competencias demostrables. Esto abre oportunidades para reclutadores que saben evaluar habilidades mas alla del CV.

### 2. IA generativa en cada etapa
Desde la redaccion de JDs hasta la generacion de reportes ejecutivos, los LLMs se estan integrando en todo el funnel de reclutamiento.

### 3. Employer branding como diferenciador
En un mercado competido por talento tech, las empresas que comunican su cultura de forma autentica atraen 2.5x mas aplicaciones organicas.

### 4. Reclutamiento interno y movilidad
El 60% de las vacantes en empresas Fortune 500 se cubren con talento interno. Los reclutadores deben dominar la gestion de talent pools internos.

### 5. Data-driven recruiting
Metricas como time-to-fill, cost-per-hire, quality-of-hire y source effectiveness son ahora indispensables. Si no mides, no mejoras.

### 6. Candidate experience como KPI
El NPS del candidato (tanto aceptados como rechazados) impacta directamente el employer brand. Automatizar sin deshumanizar es el reto.

---

**Suscribete** a la newsletter de Enlace 468 para recibir estas tendencias cada quincena directamente en tu correo.
    `,
  },
  'clase-futuro-reclutador': {
    title: 'Clase abierta: El futuro del reclutador',
    type: 'video',
    plan: 'free',
    content: null,
  },

  /* ──── FOUNDER ──── */
  'prompts-sourcing-linkedin': {
    title: 'Prompts para sourcing en LinkedIn',
    type: 'template',
    plan: 'founder',
    content: `
## 5 Prompts listos para usar en sourcing de candidatos

Copia y pega estos prompts en ChatGPT o Claude. Reemplaza los campos entre [corchetes] con tu informacion.

---

### Prompt 1: Generador de busqueda booleana

\`\`\`
Actua como un experto en sourcing de talento en LinkedIn. Necesito encontrar candidatos para la siguiente posicion:

Titulo del puesto: [Gerente de Marketing Digital]
Industria: [Tecnologia / SaaS]
Ubicacion: [Ciudad de Mexico y area metropolitana]
Experiencia requerida: [5-8 anos]
Habilidades clave: [SEO, Google Ads, Meta Ads, analytics, CRM]
Nice to have: [Experiencia en startups, ingles avanzado]

Genera 3 busquedas booleanas para LinkedIn Recruiter, de menor a mayor especificidad. Incluye variaciones de titulos en espanol e ingles. Usa operadores AND, OR, NOT y comillas.
\`\`\`

---

### Prompt 2: De Job Description a perfil ideal de candidato

\`\`\`
Analiza el siguiente Job Description y genera un perfil ideal de candidato que incluya:

1. Titulo(s) probable(s) que tendria en LinkedIn
2. Palabras clave para buscar en su perfil
3. Empresas donde probablemente trabaja o ha trabajado
4. Certificaciones o cursos relevantes
5. Busqueda booleana recomendada

Job Description:
[Pega aqui el JD completo]
\`\`\`

---

### Prompt 3: Personalizador de mensajes de outreach

\`\`\`
Eres un reclutador senior que escribe mensajes de LinkedIn con alta tasa de respuesta. Genera un InMail personalizado con estas reglas:

- Maximo 300 caracteres en el asunto
- Maximo 500 palabras en el cuerpo
- Tono profesional pero cercano
- Menciona algo especifico del perfil del candidato
- Incluye el valor de la oportunidad (no solo el titulo)
- Termina con una pregunta abierta, no con "si te interesa responde"

Informacion del candidato:
- Nombre: [Maria Lopez]
- Puesto actual: [Senior Developer en Globant]
- Experiencia destacada: [3 anos en React, contribuciones open source]
- Ubicacion: [Guadalajara]

Vacante que ofrecemos:
- Titulo: [Tech Lead Frontend]
- Empresa: [Startup fintech Serie A]
- Beneficios clave: [Equity, remoto, presupuesto de aprendizaje]
\`\`\`

---

### Prompt 4: Generador de preguntas de entrevista desde CV

\`\`\`
Analiza el siguiente CV/perfil de LinkedIn y genera:

1. 5 preguntas conductuales (STAR method) basadas en su experiencia real
2. 3 preguntas tecnicas especificas a su stack/industria
3. 2 preguntas para validar cultural fit
4. 1 pregunta para explorar motivacion de cambio
5. Red flags o inconsistencias que debo explorar

Para cada pregunta, indica que competencia estas evaluando y que respuesta esperarias de un candidato fuerte.

Perfil del candidato:
[Pega aqui el CV o resumen del perfil de LinkedIn]

Puesto al que aplica:
[Titulo y resumen del JD]
\`\`\`

---

### Prompt 5: Matriz de comparacion de candidatos

\`\`\`
Tengo [3] candidatos finalistas para el puesto de [Product Manager Senior]. Necesito una matriz de comparacion objetiva.

Para cada candidato, evalua en escala 1-5:
- Experiencia relevante
- Habilidades tecnicas
- Liderazgo demostrado
- Cultural fit (basado en la cultura de la empresa que te describo)
- Potencial de crecimiento
- Riesgo de contratacion

Candidato 1: [Nombre - resumen de experiencia]
Candidato 2: [Nombre - resumen de experiencia]
Candidato 3: [Nombre - resumen de experiencia]

Cultura de la empresa: [Startup de 50 personas, ritmo rapido, autonomia alta, metodologias agiles]

Genera la matriz en formato tabla y una recomendacion final con justificacion.
\`\`\`
    `,
  },

  'scorecard-entrevista': {
    title: 'Plantilla: Scorecard de entrevista',
    type: 'template',
    plan: 'founder',
    content: `
## Scorecard de Entrevista Estructurada

Copia esta plantilla y usala para cada entrevista. Asegura evaluaciones consistentes entre candidatos.

---

### Datos generales

\`\`\`
Candidato:     ____________________________
Puesto:        ____________________________
Entrevistador: ____________________________
Fecha:         ____________________________
Etapa:         [ ] Screening  [ ] Tecnica  [ ] Cultural  [ ] Final
\`\`\`

---

### Evaluacion por competencia (1-5)

| # | Competencia | 1 - Insuficiente | 2 - Basico | 3 - Competente | 4 - Avanzado | 5 - Excepcional | Notas |
|---|-------------|:---:|:---:|:---:|:---:|:---:|-------|
| 1 | **Habilidades tecnicas** | O | O | O | O | O | |
|   | Dominio de herramientas y conocimientos requeridos para el puesto | | | | | | |
| 2 | **Experiencia relevante** | O | O | O | O | O | |
|   | Trayectoria alineada con los retos del rol | | | | | | |
| 3 | **Comunicacion** | O | O | O | O | O | |
|   | Claridad, estructura y capacidad de escucha | | | | | | |
| 4 | **Liderazgo** | O | O | O | O | O | |
|   | Toma de decisiones, influencia y gestion de equipos | | | | | | |
| 5 | **Cultural fit** | O | O | O | O | O | |
|   | Alineacion con valores, ritmo y estilo de trabajo | | | | | | |
| 6 | **Resolucion de problemas** | O | O | O | O | O | |
|   | Pensamiento analitico y capacidad de proponer soluciones | | | | | | |
| 7 | **Motivacion y ambicion** | O | O | O | O | O | |
|   | Razon de cambio, objetivos profesionales, energia | | | | | | |

---

### Criterios de calificacion

- **1 - Insuficiente:** No cumple el minimo. Gaps significativos.
- **2 - Basico:** Cumple parcialmente. Necesitaria desarrollo importante.
- **3 - Competente:** Cumple las expectativas del puesto.
- **4 - Avanzado:** Supera expectativas en esta area. Aporta valor adicional.
- **5 - Excepcional:** Top performer. Referencia en esta competencia.

---

### Observaciones generales

\`\`\`
Fortalezas principales:
________________________________________
________________________________________

Areas de mejora o riesgo:
________________________________________
________________________________________

Preguntas pendientes o follow-up:
________________________________________
________________________________________
\`\`\`

---

### Recomendacion final

\`\`\`
[ ] CONTRATAR        - Candidato fuerte. Avanzar con oferta.
[ ] AVANZAR          - Positivo. Continuar al siguiente paso.
[ ] EVALUAR MAS      - Dudas en areas clave. Necesita otra ronda.
[ ] NO CONTRATAR     - No cumple perfil. Agradecer y cerrar.

Justificacion:
________________________________________
________________________________________
________________________________________

Puntuacion total: _____ / 35
\`\`\`
    `,
  },

  'boolean-search-avanzado': {
    title: 'Mini guia: Boolean Search avanzado',
    type: 'guide',
    plan: 'founder',
    content: `
## Domina la busqueda booleana en LinkedIn

La busqueda booleana es la habilidad #1 que separa a un reclutador promedio de uno excepcional. Con los operadores correctos, reduces horas de sourcing a minutos.

---

### Operadores basicos

| Operador | Funcion | Ejemplo |
|----------|---------|---------|
| **AND** | Ambos terminos deben aparecer | \`marketing AND digital\` |
| **OR** | Cualquiera de los terminos | \`developer OR engineer OR programador\` |
| **NOT** | Excluye un termino | \`recruiter NOT "talent acquisition"\` |
| **" "** | Frase exacta | \`"product manager"\` |
| **( )** | Agrupa condiciones | \`(developer OR engineer) AND (React OR Vue)\` |

---

### Sintaxis especifica de LinkedIn

- **title:** busca en el titulo actual -> \`title:"gerente de ventas"\`
- **company:** busca por empresa -> \`company:BBVA OR company:Banorte\`
- **school:** busca por universidad -> \`school:"ITESM" OR school:"Tecnologico de Monterrey"\`
- **NOT** en LinkedIn Recruiter se escribe como **-** (guion) en la barra de busqueda estandar

**Importante:** LinkedIn Free tiene operadores limitados. LinkedIn Recruiter y Sales Navigator permiten busquedas mas complejas.

---

### 10 busquedas booleanas para el mercado mexicano

**1. Desarrollador Full Stack senior en CDMX**
\`\`\`
(title:"full stack" OR title:"fullstack" OR title:"desarrollador" OR title:"software engineer") AND (React OR Angular OR Vue) AND (Node OR Python OR Java) AND ("Ciudad de Mexico" OR CDMX OR "Mexico City")
\`\`\`

**2. Gerente de Recursos Humanos en manufactura**
\`\`\`
(title:"gerente de recursos humanos" OR title:"HR manager" OR title:"director de RH" OR title:"head of people") AND (manufactura OR manufacturing OR "planta" OR "produccion") NOT (consultoria OR consulting OR freelance)
\`\`\`

**3. Contador con experiencia en Big 4**
\`\`\`
(title:contador OR title:"senior accountant" OR title:"tax manager" OR title:"auditor") AND (company:Deloitte OR company:PwC OR company:EY OR company:KPMG) AND (Mexico)
\`\`\`

**4. Product Manager en fintech**
\`\`\`
(title:"product manager" OR title:"product owner" OR title:"PM" OR title:"gerente de producto") AND (fintech OR "servicios financieros" OR banking OR neobank) AND (Mexico OR remoto OR remote)
\`\`\`

**5. Ejecutivo de ventas B2B SaaS**
\`\`\`
(title:"account executive" OR title:"ejecutivo de ventas" OR title:"sales" OR title:"business development") AND (SaaS OR "software" OR "tech") AND (B2B) AND (Mexico OR LATAM)
\`\`\`

**6. Data Engineer / Cientifico de datos**
\`\`\`
(title:"data engineer" OR title:"data scientist" OR title:"ingeniero de datos" OR title:"machine learning") AND (Python OR SQL OR Spark OR Databricks) AND (Mexico OR remoto) NOT (intern OR practicante OR becario)
\`\`\`

**7. Disenador UX/UI con experiencia en producto**
\`\`\`
(title:"UX designer" OR title:"UI designer" OR title:"product designer" OR title:"disenador") AND (Figma OR Sketch) AND ("user research" OR "design system" OR prototipo) AND (Mexico)
\`\`\`

**8. Gerente de operaciones / Supply Chain**
\`\`\`
(title:"gerente de operaciones" OR title:"operations manager" OR title:"supply chain" OR title:"logistica" OR title:"director de operaciones") AND (Mexico OR Monterrey OR Guadalajara OR Queretaro) NOT (analista OR asistente OR auxiliar)
\`\`\`

**9. Talent Acquisition Specialist**
\`\`\`
(title:"talent acquisition" OR title:"reclutador" OR title:"recruiter" OR title:"sourcer") AND (tech OR "tecnologia" OR IT OR SaaS) AND (Mexico) AND (LinkedIn OR sourcing OR "employer branding")
\`\`\`

**10. CFO / Director de finanzas en empresas medianas**
\`\`\`
(title:CFO OR title:"director de finanzas" OR title:"VP finance" OR title:"chief financial") AND (Mexico) AND ("100" OR "200" OR "500" OR "startup" OR "serie" OR "growth") NOT (analista OR auxiliar OR asistente OR contador)
\`\`\`

---

### Tips avanzados

1. **Combina idiomas.** En Mexico, los titulos mezclan espanol e ingles. Siempre incluye variaciones en ambos idiomas.

2. **Usa NOT estrategicamente.** Excluye niveles junior (\`NOT intern NOT becario NOT practicante NOT jr NOT junior\`) para busquedas senior.

3. **Filtra por cambio reciente.** En LinkedIn Recruiter, usa el filtro "Changed jobs in last 90 days" para encontrar candidatos que acaban de moverse (y quizas no esten completamente satisfechos).

4. **Guarda tus busquedas.** Crea "Search Alerts" para recibir nuevos perfiles que coincidan con tus queries automaticamente.

5. **No dependas solo de titulos.** Busca por habilidades listadas en el perfil: muchos candidatos tienen titulos genericos pero skills muy especificos.
    `,
  },

  'reporte-ejecutivo-vacante': {
    title: 'Plantilla: Reporte ejecutivo de vacante',
    type: 'template',
    plan: 'founder',
    content: `
## Reporte Ejecutivo de Vacante

Usa esta plantilla para informar a hiring managers sobre el avance de cada posicion.

---

\`\`\`
═══════════════════════════════════════════════════
           REPORTE EJECUTIVO DE VACANTE
═══════════════════════════════════════════════════

DATOS DE LA POSICION
--------------------
Vacante:           ____________________________
Area/Departamento: ____________________________
Hiring Manager:    ____________________________
Reclutador:        ____________________________
Fecha de apertura: ____________________________
Fecha del reporte: ____________________________
SLA comprometido:  ______ dias

ESTATUS GENERAL
---------------
[ ] En sourcing    [ ] Entrevistas    [ ] Oferta    [ ] Cerrada

METRICAS DEL PIPELINE
----------------------
Candidatos identificados:     _____
Candidatos contactados:       _____
Interesados / respondieron:   _____
En screening:                 _____
Entrevista con hiring manager:_____
Finalistas:                   _____
Ofertas extendidas:           _____

Tasa de respuesta:            _____%
Tasa de conversion:           _____%
Dias transcurridos:           _____

CANDIDATOS EN PROCESO
---------------------
| Nombre | Empresa actual | Etapa | Fortalezas | Riesgo |
|--------|---------------|-------|------------|--------|
| 1.     |               |       |            |        |
| 2.     |               |       |            |        |
| 3.     |               |       |            |        |

CANDIDATOS DESCARTADOS (top 3 y razon)
--------------------------------------
| Nombre | Razon de descarte |
|--------|-------------------|
| 1.     |                   |
| 2.     |                   |
| 3.     |                   |

OBSERVACIONES DEL MERCADO
-------------------------
Rango salarial del mercado:  $_______ - $_______
Nuestra oferta:              $_______
Competitividad:              [ ] Baja  [ ] Media  [ ] Alta

Comentarios:
________________________________________
________________________________________

RIESGOS Y BLOQUEOS
-------------------
________________________________________
________________________________________

PROXIMOS PASOS
--------------
[ ] ________________________________________
[ ] ________________________________________
[ ] ________________________________________

Proxima actualizacion: ___/___/______

═══════════════════════════════════════════════════
\`\`\`
    `,
  },

  'screening-asistido-ia': {
    title: 'Guia: Screening asistido por IA',
    type: 'guide',
    plan: 'founder',
    content: `
## Screening de candidatos asistido por IA

Aprende a usar ChatGPT, Claude u otros LLMs para hacer screening de CVs de forma rapida, consistente y documentada.

---

### El problema del screening manual

- Un reclutador promedio recibe **150-250 CVs** por vacante
- Dedicar 2 minutos por CV = **5-8 horas** solo en revision inicial
- La fatiga reduce la calidad de evaluacion despues de los primeros 30 CVs
- Sesgos inconscientes afectan decisiones (universidad, genero, edad)

### Como la IA puede ayudar

La IA NO toma la decision. Tu sigues siendo el experto. Pero puede:

1. **Pre-filtrar** candidatos que claramente no cumplen requisitos minimos
2. **Extraer informacion clave** de CVs no estructurados
3. **Comparar** el perfil contra el job description de forma objetiva
4. **Generar preguntas** personalizadas para cada candidato
5. **Documentar** razones de avance o descarte

---

### Prompt para screening rapido

\`\`\`
Analiza el siguiente CV contra el Job Description proporcionado.

JOB DESCRIPTION:
[Pega el JD aqui]

CV DEL CANDIDATO:
[Pega el CV aqui]

Genera un analisis con este formato:
1. MATCH SCORE: (1-10)
2. CUMPLE REQUISITOS MINIMOS: Si/No
   - [Lista cada requisito y si lo cumple]
3. FORTALEZAS: (3-5 puntos)
4. GAPS O RED FLAGS: (si existen)
5. PREGUNTAS SUGERIDAS: (3 preguntas especificas para esta persona)
6. RECOMENDACION: Avanzar / Evaluar mas / Descartar
7. JUSTIFICACION: (2-3 oraciones)
\`\`\`

---

### Prompt para screening masivo (batch)

\`\`\`
Tengo [5] CVs para la posicion de [titulo]. Necesito que evalues cada uno contra estos criterios obligatorios:

CRITERIOS OBLIGATORIOS:
1. [Minimo 3 anos de experiencia en X]
2. [Dominio de herramienta Y]
3. [Ubicacion en Z o disponibilidad para reubicarse]

CRITERIOS DESEABLES:
1. [Certificacion A]
2. [Experiencia en industria B]
3. [Ingles avanzado]

Para cada candidato, genera una fila con:
Nombre | Score (1-10) | Cumple obligatorios (Si/No) | Deseables que cumple | Recomendacion

Ordena de mayor a menor score.

CANDIDATO 1:
[CV]

CANDIDATO 2:
[CV]
... etc
\`\`\`

---

### Red flags que la IA puede detectar

- Gaps de empleo no explicados (mas de 6 meses)
- Cambios de trabajo muy frecuentes (menos de 1 ano en los ultimos 3 roles)
- Inconsistencias entre titulo del puesto y responsabilidades descritas
- Over-qualification que podria indicar riesgo de retencion
- Skills listados sin evidencia de uso real en la experiencia

---

### Mejores practicas

1. **Nunca descalifies solo por lo que dice la IA.** Siempre revisa los CVs que la IA recomienda descartar.

2. **Usa el mismo prompt para todos los candidatos** de una vacante. Asi la evaluacion es comparable.

3. **Documenta el criterio.** Guarda los prompts y resultados. Esto te protege ante auditorias de equidad.

4. **Calibra con tu hiring manager.** Muestra los primeros 5 analisis al HM y ajusta los criterios segun su feedback.

5. **No compartas CVs con IA publica** sin anonimizar datos personales sensibles (CURP, RFC, direccion). Usa herramientas con politicas de privacidad adecuadas.
    `,
  },
}

/* ─────────────────────────── COMPONENT ─────────────────────────── */

export default function ResourceViewer() {
  const { resourceId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [copied, setCopied] = useState(false)

  const resource = RESOURCES[resourceId]

  if (!resource) {
    return (
      <div className="text-center py-20">
        <BookOpen size={48} className="mx-auto text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Recurso no encontrado</h2>
        <p className="text-gray-400 mb-6">El recurso que buscas no existe o fue removido.</p>
        <button onClick={() => navigate('/dashboard/academy')}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          Volver a Academy
        </button>
      </div>
    )
  }

  const handleCopy = () => {
    if (!resource.content) return
    navigator.clipboard.writeText(resource.content.trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Video placeholder
  if (resource.type === 'video') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <button onClick={() => navigate('/dashboard/academy')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6 text-sm">
          <ArrowLeft size={16} /> Volver a Academy
        </button>

        <div className="glass rounded-2xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center mx-auto mb-6">
            <Video size={36} className="text-primary-light" />
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-3">{resource.title}</h1>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Esta clase en video estara disponible proximamente. Te notificaremos cuando este lista.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium">
            <Star size={16} />
            Proximamente
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <button onClick={() => navigate('/dashboard/academy')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
          <ArrowLeft size={16} /> Volver a Academy
        </button>

        <div className="flex items-center gap-2">
          {resource.type === 'template' && (
            <button onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
              {copied ? <><Check size={16} /> Copiado</> : <><ClipboardCopy size={16} /> Copiar al portapapeles</>}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="glass rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-primary-light">
            {resource.type === 'template' ? <Download size={20} /> :
             resource.type === 'guide' ? <FileText size={20} /> :
             <BookOpen size={20} />}
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-white">{resource.title}</h1>
            <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
              resource.plan === 'free'
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              {resource.plan === 'free' ? 'Gratis' : 'Founder'}
            </span>
          </div>
        </div>

        {/* Render markdown-like content */}
        <div className="prose-custom">
          <MarkdownRenderer content={resource.content} />
        </div>
      </div>
    </motion.div>
  )
}

/* ─────────────────────────── MARKDOWN RENDERER ─────────────────────────── */

function MarkdownRenderer({ content }) {
  if (!content) return null

  const lines = content.trim().split('\n')
  const elements = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block
    if (line.trim().startsWith('```')) {
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      elements.push(
        <CodeBlock key={key++} code={codeLines.join('\n')} />
      )
      continue
    }

    // Table
    if (line.includes('|') && line.trim().startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].includes('|') && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      elements.push(<TableBlock key={key++} lines={tableLines} />)
      continue
    }

    // Heading
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-base font-semibold text-white mt-6 mb-2">{line.slice(4)}</h3>)
      i++; continue
    }
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-lg font-display font-semibold text-white mt-8 mb-3">{line.slice(3)}</h2>)
      i++; continue
    }

    // Horizontal rule
    if (line.trim() === '---') {
      elements.push(<hr key={key++} className="border-white/10 my-6" />)
      i++; continue
    }

    // Bullet point
    if (line.trim().startsWith('- ')) {
      const items = []
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2))
        i++
      }
      elements.push(
        <ul key={key++} className="space-y-1.5 my-3 ml-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 flex-shrink-0" />
              <span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Numbered list
    if (/^\d+\.\s/.test(line.trim())) {
      const items = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''))
        i++
      }
      elements.push(
        <ol key={key++} className="space-y-1.5 my-3 ml-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
              <span className="text-primary-light font-semibold text-xs mt-0.5 flex-shrink-0">{j + 1}.</span>
              <span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Empty line
    if (line.trim() === '') {
      i++; continue
    }

    // Paragraph
    elements.push(
      <p key={key++} className="text-sm text-gray-300 leading-relaxed my-2"
         dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
    )
    i++
  }

  return <>{elements}</>
}

function inlineFormat(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="px-1.5 py-0.5 bg-white/10 rounded text-primary-light text-xs font-mono">$1</code>')
    .replace(/\[(.+?)\]/g, '<span class="text-accent">$1</span>')
}

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative my-4 rounded-xl overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Prompt / Plantilla</span>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors">
          {copied ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
        </button>
      </div>
      <pre className="p-4 text-sm text-gray-300 overflow-x-auto font-mono whitespace-pre-wrap leading-relaxed">
        {code.trim()}
      </pre>
    </div>
  )
}

function TableBlock({ lines }) {
  // Filter out separator rows (|---|---|)
  const dataLines = lines.filter(l => !l.trim().match(/^\|[\s\-:|]+\|$/))
  if (dataLines.length === 0) return null

  const parseRow = (line) =>
    line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(cell => cell.trim())

  const headers = parseRow(dataLines[0])
  const rows = dataLines.slice(1).map(parseRow)

  return (
    <div className="my-4 overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/[0.04]">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider"
                  dangerouslySetInnerHTML={{ __html: inlineFormat(h) }} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-gray-300"
                    dangerouslySetInnerHTML={{ __html: inlineFormat(cell) }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
