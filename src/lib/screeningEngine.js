/**
 * Screening Engine — runs entirely in the browser
 * Uses TF-IDF cosine similarity + keyword matching + structured extraction
 * No API keys, no external calls, no model downloads
 */

// --- Stopwords (Spanish) ---
const STOPWORDS = new Set('de la el en y a los las del un una por con para su se al lo que es no mas del como pero sus le ya o fue ha era muy sin sobre este ser entre cuando todo esta son dos tambien fue habia desde su ya nos ni porque que hay sido tiene ante ellos esta tiene les asi puede me nuestro alguna esto si me mis tu nuestros ninguna otros ella nosotros ustedes ellas'.split(' '))

// --- Tokenization ---
function tokenize(text) {
  return (text || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t))
}

// --- TF-IDF ---
function computeTFIDF(docs) {
  const N = docs.length
  const tokenizedDocs = docs.map(d => tokenize(d))
  const df = {}

  tokenizedDocs.forEach(tokens => {
    const seen = new Set()
    tokens.forEach(t => { if (!seen.has(t)) { df[t] = (df[t] || 0) + 1; seen.add(t) } })
  })

  return tokenizedDocs.map(tokens => {
    const tf = {}
    tokens.forEach(t => { tf[t] = (tf[t] || 0) + 1 })
    const vec = {}
    const maxTF = Math.max(...Object.values(tf), 1)
    Object.keys(tf).forEach(t => {
      vec[t] = (tf[t] / maxTF) * Math.log(N / (df[t] || 1))
    })
    return vec
  })
}

function cosineSimilarity(vecA, vecB) {
  const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)])
  let dot = 0, magA = 0, magB = 0
  allKeys.forEach(k => {
    const a = vecA[k] || 0, b = vecB[k] || 0
    dot += a * b; magA += a * a; magB += b * b
  })
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

// --- Skills extraction ---
function extractSkills(text) {
  const normalized = (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const skills = []
  const skillPatterns = [
    // Languages & frameworks
    'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'node', 'express',
    'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'redis', 'docker', 'kubernetes', 'aws',
    'azure', 'gcp', 'git', 'ci/cd', 'devops', 'linux', 'html', 'css', 'sass', 'tailwind',
    // Business
    'excel', 'power bi', 'tableau', 'sap', 'erp', 'crm', 'salesforce', 'hubspot',
    'marketing', 'ventas', 'finanzas', 'contabilidad', 'recursos humanos', 'reclutamiento',
    'gestion de proyectos', 'project management', 'scrum', 'agile', 'kanban', 'lean',
    'negociacion', 'liderazgo', 'comunicacion', 'trabajo en equipo', 'presentaciones',
    // Languages
    'ingles', 'english', 'frances', 'aleman', 'portugues', 'italiano', 'mandarin',
    // Education
    'licenciatura', 'maestria', 'doctorado', 'mba', 'diplomado', 'certificacion',
    'ingeniero', 'ingenieria', 'administracion', 'derecho', 'economia', 'psicologia',
    // General
    'analisis de datos', 'data analysis', 'machine learning', 'inteligencia artificial',
    'automatizacion', 'estrategia', 'planeacion', 'presupuesto', 'kpi', 'roi',
    'atencion al cliente', 'servicio al cliente', 'logistica', 'cadena de suministro',
    'compliance', 'regulacion', 'auditoria', 'riesgo', 'calidad', 'mejora continua',
  ]
  skillPatterns.forEach(s => {
    if (normalized.includes(s)) skills.push(s)
  })
  return [...new Set(skills)]
}

// --- Experience extraction ---
function extractYearsExperience(text) {
  const normalized = (text || '').toLowerCase()
  const patterns = [
    /(\d+)\+?\s*(?:anos?|years?)\s*(?:de\s*)?(?:experiencia|experience)/i,
    /experiencia\s*(?:de\s*)?(\d+)\+?\s*(?:anos?|years?)/i,
    /(\d+)\+?\s*(?:anos?|years?)\s*(?:en\s*el\s*(?:puesto|area|sector))/i,
  ]
  for (const p of patterns) {
    const m = normalized.match(p)
    if (m) return parseInt(m[1])
  }
  // Count distinct years mentioned (e.g., "2018 - 2024")
  const yearMatches = normalized.match(/20[0-2]\d/g)
  if (yearMatches && yearMatches.length >= 2) {
    const years = yearMatches.map(Number)
    return Math.max(...years) - Math.min(...years)
  }
  return null
}

// --- Main screening function ---
export function screenCandidate(jobDescription, competencies, cvText) {
  // 1. Semantic similarity (TF-IDF)
  const jobFullText = `${jobDescription} ${(competencies || []).map(c => c.name).join(' ')}`
  const tfidfVecs = computeTFIDF([jobFullText, cvText])
  const semanticScore = cosineSimilarity(tfidfVecs[0], tfidfVecs[1])

  // 2. Skills matching
  const jobSkills = extractSkills(jobFullText)
  const cvSkills = extractSkills(cvText)
  const matchedSkills = jobSkills.filter(s => cvSkills.includes(s))
  const skillScore = jobSkills.length > 0 ? matchedSkills.length / jobSkills.length : 0

  // 3. Competencies matching (from vacancy)
  let compScore = 0
  const compMatches = []
  if (competencies?.length) {
    const cvLower = cvText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    competencies.forEach(comp => {
      const compNorm = comp.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const words = compNorm.split(/\s+/).filter(w => w.length > 3)
      const found = words.some(w => cvLower.includes(w))
      if (found) compMatches.push(comp.name)
    })
    compScore = compMatches.length / competencies.length
  }

  // 4. Experience
  const cvYears = extractYearsExperience(cvText)

  // 5. Weighted total
  const total = Math.round(
    (semanticScore * 30) +
    (skillScore * 35) +
    (compScore * 25) +
    (cvYears ? Math.min(cvYears / 10, 1) * 10 : 5) // 10% for experience, default 5 if unknown
  )

  // 6. Generate summary
  const strengths = []
  const gaps = []

  if (matchedSkills.length > 0) strengths.push(`Skills: ${matchedSkills.slice(0, 4).join(', ')}`)
  if (compMatches.length > 0) strengths.push(`Competencias: ${compMatches.slice(0, 3).join(', ')}`)
  if (cvYears) strengths.push(`${cvYears} años de experiencia`)
  if (semanticScore > 0.3) strengths.push('Perfil relevante al puesto')

  const missingSkills = jobSkills.filter(s => !cvSkills.includes(s))
  if (missingSkills.length > 0) gaps.push(`Falta: ${missingSkills.slice(0, 3).join(', ')}`)
  const missingComps = (competencies || []).map(c => c.name).filter(c => !compMatches.includes(c))
  if (missingComps.length > 0) gaps.push(`Sin evidencia: ${missingComps.slice(0, 2).join(', ')}`)

  return {
    score: Math.min(total, 100),
    semanticScore: Math.round(semanticScore * 100),
    skillScore: Math.round(skillScore * 100),
    compScore: Math.round(compScore * 100),
    experienceYears: cvYears,
    matchedSkills,
    missingSkills: missingSkills.slice(0, 5),
    compMatches,
    strengths,
    gaps,
    summary: strengths.length > 0
      ? `${strengths.join(' · ')}${gaps.length ? ' | ' + gaps.join(' · ') : ''}`
      : 'Perfil con baja coincidencia',
  }
}

// --- Dummy CVs for testing ---
export const DUMMY_CVS = [
  {
    name: 'Ingrid Escobar Valencia',
    cv: `INGRID ESCOBAR VALENCIA
Directora de Recursos Humanos | MBA | 12 años de experiencia

EXPERIENCIA PROFESIONAL
2019 - Presente | Directora de RH | Grupo Financiero Nacional
- Liderazgo de equipo de 25 personas en reclutamiento, capacitacion y desarrollo organizacional
- Implementacion de estrategia de employer branding, reduciendo rotacion 35%
- Gestion de presupuesto de $15M MXN anuales
- Negociacion con sindicatos y manejo de relaciones laborales
- KPIs de reclutamiento: time-to-hire reducido de 45 a 22 dias

2015 - 2019 | Gerente de Talento | Empresa de Tecnologia
- Reclutamiento de perfiles tech: developers, data scientists, product managers
- Diseño de programa de onboarding y plan de carrera
- Evaluaciones de desempeño 360 grados
- Implementacion de SAP SuccessFactors

EDUCACION
MBA - IPADE Business School (2018)
Licenciatura en Psicologia Organizacional - UNAM (2012)
Certificacion SHRM-SCP

HABILIDADES
Liderazgo, Negociacion, SAP, Excel avanzado, Power BI, Ingles avanzado (C1)
Reclutamiento, Seleccion, Capacitacion, Desarrollo organizacional, Employer branding
Gestion de proyectos, Scrum, Trabajo en equipo, Comunicacion ejecutiva`
  },
  {
    name: 'Carlos Mendoza Torres',
    cv: `CARLOS MENDOZA TORRES
Analista de Datos | 3 años de experiencia

EXPERIENCIA
2022 - Presente | Analista Jr | Consultora de Marketing
- Reportes mensuales en Excel y Google Sheets
- Manejo basico de bases de datos MySQL
- Apoyo en campañas de marketing digital

2021 - 2022 | Practicante | Despacho contable
- Captura de datos fiscales
- Archivo y organizacion documental

EDUCACION
Licenciatura en Administracion - Universidad del Valle de Mexico (2021)

HABILIDADES
Excel, Word, PowerPoint, Google Sheets, MySQL basico, Ingles intermedio (B1)`
  },
  {
    name: 'Ana Patricia Ruiz Gomez',
    cv: `ANA PATRICIA RUIZ GOMEZ
Head of People & Culture | 15 años de experiencia en RRHH

EXPERIENCIA
2020 - Presente | VP de People | Startup Fintech (Serie B, 200 empleados)
- Escalamiento de equipo de 40 a 200 personas en 2 años
- Diseño de estructura organizacional, bandas salariales y equity plan
- Implementacion de cultura remote-first con equipos en 5 paises
- Compliance laboral en Mexico, Colombia y USA
- Automatizacion de procesos de RRHH con BambooHR y Slack integrations

2016 - 2020 | Directora de Talento | Corporativo Financiero
- Reclutamiento ejecutivo y headhunting para posiciones C-level
- Programa de liderazgo para 150+ gerentes
- Transformacion digital del area de RRHH
- Reduccion de rotacion de 28% a 12%
- Presupuesto anual de $20M MXN

2010 - 2016 | Gerente de RRHH | Empresa de Retail
- Manejo de nomina para 500+ colaboradores
- Relaciones laborales y negociacion sindical
- Implementacion de SAP HCM

EDUCACION
Maestria en Desarrollo Organizacional - ITESM (2015)
Licenciatura en Relaciones Industriales - UIA (2009)
Certificacion en Coaching Ejecutivo - ICF
Diplomado en Derecho Laboral - UNAM

HABILIDADES
Liderazgo estrategico, Coaching, Negociacion, Finanzas de RRHH
SAP, BambooHR, Workday, Power BI, Excel avanzado, Tableau
Ingles nativo, Frances intermedio
Gestion de proyectos, Agile, Scrum, Design thinking
Employer branding, Cultura organizacional, Diversidad e inclusion`
  },
  {
    name: 'Roberto Luna Martinez',
    cv: `ROBERTO LUNA MARTINEZ
Ingeniero de Software | 5 años de experiencia

EXPERIENCIA
2021 - Presente | Senior Developer | Agencia Digital
- Desarrollo full-stack con React, Node.js y PostgreSQL
- Arquitectura de microservicios en AWS
- CI/CD con GitHub Actions y Docker
- Lider tecnico de equipo de 4 personas

2019 - 2021 | Developer | Startup de E-commerce
- Frontend con React y TypeScript
- APIs REST con Express
- MongoDB y Redis

EDUCACION
Ingenieria en Computacion - IPN (2019)
Certificacion AWS Solutions Architect

HABILIDADES
JavaScript, TypeScript, React, Node.js, Python, SQL, MongoDB
Docker, Kubernetes, AWS, Git, CI/CD, Linux
Ingles avanzado (C1), Trabajo en equipo, Metodologias agiles`
  },
  {
    name: 'Maria Fernanda Diaz',
    cv: `MARIA FERNANDA DIAZ
Gerente de Reclutamiento | 8 años de experiencia

EXPERIENCIA
2020 - Presente | Gerente de Reclutamiento | Empresa Manufacturera
- Reclutamiento de alto volumen: 50+ posiciones mensuales
- Manejo de ATS (Workday Recruiting)
- Coordinacion con hiring managers de 6 plantas
- Presupuesto de reclutamiento de $3M MXN
- Sourcing en LinkedIn, OCC, Indeed, CompuTrabajo

2017 - 2020 | Coordinadora de Seleccion | Consultora de RRHH
- Entrevistas por competencias y assessment centers
- Evaluaciones psicometricas y referencias laborales
- Reclutamiento de perfiles operativos, administrativos y gerenciales

2015 - 2017 | Reclutadora Jr | Agencia de empleo
- Publicacion de vacantes y screening de CVs
- Entrevistas iniciales y filtrado

EDUCACION
Licenciatura en Psicologia - UNAM (2015)
Diplomado en Gestion del Talento - ITESM (2019)

HABILIDADES
Reclutamiento, Seleccion, Entrevistas por competencias, Assessment centers
Workday, LinkedIn Recruiter, OCC, Indeed, Excel, PowerPoint
Ingles intermedio-avanzado (B2), Negociacion, Comunicacion
Atencion al cliente, Trabajo en equipo, Gestion de proyectos`
  },
  {
    name: 'Javier Ortega Perez',
    cv: `JAVIER ORTEGA PEREZ
Recien egresado | Busco primera oportunidad

EDUCACION
Licenciatura en Comunicacion - Universidad Autonoma (2024)

EXPERIENCIA
2023 | Practicante de Social Media | Agencia local
- Publicaciones en redes sociales
- Monitoreo basico de metricas

HABILIDADES
Canva, Instagram, Facebook, TikTok, Word, PowerPoint
Redaccion, Creatividad`
  },
]
