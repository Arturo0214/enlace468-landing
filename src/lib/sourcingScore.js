// ---------------------------------------------------------------------------
// Sourcing relevance scorer — ranks a search-result profile (LinkedIn title +
// snippet) against a vacancy, so the auto-sourcing pipeline only surfaces good
// prospects. Tuned for SHORT text (search snippets are ~150 chars), unlike
// screeningEngine.js which expects a full CV.
//
// Pure & side-effect free → shared by:
//   - netlify/functions/auto-source.mjs  (server-side ranking)
//   - src/components/vacancies/SourcingTab.jsx (client display / re-rank)
//
// Score 0-100:  role/title 45 · competencias 30 · keywords 15 · ubicación 10
// ---------------------------------------------------------------------------
import { normalizeText } from './excludedCompanies.js'

const STOP = new Set(
  'de la el en y a los las un una por con para su se al lo que es del como pero mas o e u sobre segun sus les experiencia experience profesional professional años anos'.split(' ')
)

/** Normalized content tokens (>2 chars, no stopwords). */
function tokenize(s) {
  return normalizeText(s)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP.has(t))
}

// Seniority signals — a prospect that matches the vacancy's seniority scores a
// small bonus; a clear junior on a senior role gets a penalty.
const SENIOR_WORDS = ['director', 'directora', 'head', 'vp', 'chief', 'gerente', 'manager', 'lead', 'senior', 'jefe', 'coordinador', 'principal']
const JUNIOR_WORDS = ['practicante', 'intern', 'becario', 'trainee', 'junior', 'jr', 'auxiliar', 'asistente', 'recien egresado', 'estudiante']

// Bilingual ES↔EN synonym groups — estamos en México: "finance consultant" y
// "consultor financiero" son lo mismo. Cada token de un grupo hace match si el
// texto contiene CUALQUIER miembro del grupo.
const SYNONYM_GROUPS = [
  ['finance', 'finances', 'financial', 'finanzas', 'financiero', 'financiera', 'financieros'],
  ['consultant', 'consulting', 'consultancy', 'consultor', 'consultora', 'consultores', 'consultoria', 'asesor', 'asesora', 'asesoria', 'advisor', 'advisory'],
  ['manager', 'management', 'gerente', 'gerencia', 'director', 'directora', 'direccion', 'jefe', 'jefa'],
  ['analyst', 'analytics', 'analista', 'analisis'],
  ['accounting', 'accountant', 'contabilidad', 'contador', 'contadora', 'contable'],
  ['marketing', 'mercadotecnia', 'mercadeo'],
  ['sales', 'selling', 'ventas', 'comercial', 'vendedor'],
  ['investment', 'investments', 'inversion', 'inversiones', 'inversionista'],
  ['human', 'resources', 'recursos', 'humanos', 'rrhh', 'talent', 'talento', 'reclutamiento', 'recruiter', 'recruitment'],
  ['engineer', 'engineering', 'ingeniero', 'ingeniera', 'ingenieria'],
  ['developer', 'development', 'desarrollador', 'desarrollo', 'programador', 'software'],
  ['project', 'projects', 'proyecto', 'proyectos'],
  ['audit', 'auditing', 'auditor', 'auditoria'],
  ['tax', 'taxes', 'fiscal', 'impuestos', 'tributario'],
  ['controller', 'contralor', 'contraloria', 'controlaria'],
  ['treasury', 'treasurer', 'tesoreria', 'tesorero'],
  ['risk', 'risks', 'riesgo', 'riesgos'],
  ['operations', 'operation', 'operaciones', 'operativo'],
  ['logistics', 'logistica', 'supply', 'suministro', 'abastecimiento'],
  ['legal', 'lawyer', 'abogado', 'juridico', 'derecho'],
  ['data', 'datos'],
]
const SYNONYM_INDEX = new Map()
for (const group of SYNONYM_GROUPS) {
  for (const w of group) SYNONYM_INDEX.set(w, group)
}

// ── Filtro geográfico ──────────────────────────────────────────
// Las búsquedas "site:linkedin.com/in" traen perfiles de todo el mundo (los de
// EUA/India/UK viven bajo www.linkedin.com, sin subdominio que los delate —
// reporte de Karina 2026-08-28). Señales de que el perfil vive FUERA de México:
// países y ciudades elegidos para no chocar con nombres propios, colonias o
// universidades mexicanas (por eso NO están: roma, sofia, orlando, virginia,
// leon, colorado, nevada, san francisco, san antonio…).
const FOREIGN_SIGNALS = [
  // LatAm + España (los originales)
  'peru', 'chile', 'argentina', 'colombia', 'ecuador', 'bolivia', 'venezuela',
  'uruguay', 'paraguay', 'brasil', 'brazil', 'espana', 'spain', 'guatemala',
  'honduras', 'nicaragua', 'panama', 'costa rica', 'el salvador',
  'republica dominicana', 'puerto rico', 'buenos aires', 'bogota', 'medellin',
  'santiago de chile', 'guayaquil', 'quito', 'montevideo', 'caracas',
  'sao paulo', 'lima peru', 'cuba', 'la habana', 'jamaica', 'haiti', 'belice', 'belize',
  'madrid', 'barcelona espana', 'valencia espana', 'sevilla',
  // Estados Unidos y Canadá
  'estados unidos', 'united states', 'new york', 'nueva york', 'california',
  'texas', 'florida', 'miami', 'chicago', 'houston', 'dallas', 'seattle',
  'boston', 'denver', 'atlanta', 'philadelphia', 'las vegas', 'los angeles',
  'san diego', 'new jersey', 'illinois', 'ohio', 'michigan', 'massachusetts',
  'pennsylvania', 'north carolina', 'washington dc', 'canada', 'toronto',
  'vancouver', 'montreal', 'ottawa', 'calgary',
  // Reino Unido e Irlanda
  'reino unido', 'united kingdom', 'inglaterra', 'england', 'londres', 'london',
  'manchester', 'birmingham', 'escocia', 'scotland', 'glasgow', 'edimburgo',
  'edinburgh', 'irlanda', 'ireland', 'dublin',
  // Europa
  'francia', 'france', 'paris', 'alemania', 'germany', 'berlin', 'munich',
  'frankfurt', 'hamburgo', 'hamburg', 'italia', 'italy', 'milano', 'portugal',
  'lisboa', 'lisbon', 'paises bajos', 'netherlands', 'holanda', 'amsterdam',
  'rotterdam', 'belgica', 'belgium', 'bruselas', 'brussels', 'suiza',
  'switzerland', 'zurich', 'ginebra', 'geneva', 'austria', 'viena', 'vienna',
  'polonia', 'poland', 'varsovia', 'warsaw', 'cracovia', 'krakow', 'rumania',
  'romania', 'bucarest', 'bucharest', 'hungria', 'hungary', 'budapest',
  'grecia', 'greece', 'atenas', 'athens', 'suecia', 'sweden', 'estocolmo',
  'stockholm', 'noruega', 'norway', 'oslo', 'dinamarca', 'denmark',
  'copenhague', 'copenhagen', 'finlandia', 'finland', 'helsinki',
  'republica checa', 'czech republic', 'chequia', 'praga', 'prague',
  'eslovaquia', 'slovakia', 'bulgaria', 'serbia', 'belgrado', 'croacia',
  'croatia', 'ucrania', 'ukraine', 'kiev', 'kyiv', 'rusia', 'russia', 'moscu',
  'moscow', 'turquia', 'turkey', 'estambul', 'istanbul', 'ankara',
  // India y resto de Asia
  'india', 'mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai',
  'pune', 'kolkata', 'gurgaon', 'gurugram', 'noida', 'ahmedabad', 'jaipur',
  'pakistan', 'karachi', 'lahore', 'islamabad', 'bangladesh', 'dhaka',
  'sri lanka', 'nepal', 'china', 'beijing', 'shanghai', 'shenzhen', 'hong kong',
  'taiwan', 'taipei', 'japon', 'japan', 'tokio', 'tokyo', 'osaka',
  'corea del sur', 'south korea', 'seul', 'seoul', 'singapur', 'singapore',
  'filipinas', 'philippines', 'manila', 'indonesia', 'jakarta', 'malasia',
  'malaysia', 'kuala lumpur', 'tailandia', 'thailand', 'bangkok', 'vietnam',
  'hanoi', 'ho chi minh',
  // Medio Oriente, África y Oceanía
  'emiratos arabes', 'united arab emirates', 'dubai', 'abu dhabi', 'qatar',
  'doha', 'arabia saudita', 'saudi arabia', 'riyadh', 'kuwait', 'israel',
  'tel aviv', 'egipto', 'egypt', 'el cairo', 'cairo', 'sudafrica',
  'south africa', 'johannesburgo', 'johannesburg', 'cape town', 'nigeria',
  'kenia', 'kenya', 'nairobi', 'marruecos', 'morocco', 'australia', 'sydney',
  'melbourne', 'brisbane', 'nueva zelanda', 'new zealand', 'auckland',
]
// Si el texto también menciona México (o una ciudad mexicana), NO se descarta:
// puede ser un mexicano con experiencia regional ("responsable de México y Perú").
const MEXICO_SIGNALS = [
  'mexico', 'mexicana', 'mexicano', 'cdmx', 'ciudad de mexico', 'guadalajara',
  'monterrey', 'queretaro', 'puebla', 'tijuana', 'merida', 'cancun', 'toluca',
  'aguascalientes', 'chihuahua', 'hermosillo', 'culiacan', 'veracruz',
  'estado de mexico', 'nuevo leon', 'jalisco', 'mexicali', 'saltillo',
  'morelia', 'san luis potosi', 'tampico', 'oaxaca', 'chiapas', 'tabasco',
  'yucatan', 'sonora', 'sinaloa', 'durango', 'zacatecas', 'guanajuato',
  'michoacan', 'morelos', 'cuernavaca', 'pachuca', 'tlaxcala', 'colima',
  'nayarit', 'irapuato', 'celaya', 'ciudad juarez', 'reynosa', 'ensenada',
  'naucalpan', 'tlalnepantla', 'ecatepec', 'coyoacan', 'polanco', 'interlomas',
  'edomex', 'leon gto', 'torreon', 'campeche', 'quintana roo', 'baja california',
]
const wordRe = w => new RegExp(`\\b${w}\\b`)

/** Devuelve la señal de país extranjero encontrada, o null si el texto menciona
 *  México o no hay señal. Espera texto crudo (se normaliza adentro). */
export function detectForeignLocation(text) {
  const t = normalizeText(text)
  if (!t) return null
  if (MEXICO_SIGNALS.some(w => wordRe(w).test(t))) return null
  return FOREIGN_SIGNALS.find(w => wordRe(w).test(t)) || null
}

/** BLOQUEO de perfiles extranjeros: true si la URL de LinkedIn viene de un
 *  subdominio de otro país (pe., cl., ar…) o si el texto delata otro país.
 *  Compartido por el server (auto-source, search-candidates) y el front. */
export function isForeignProfile(url, ...texts) {
  const m = String(url || '').match(/https?:\/\/([a-z]{2,3})\.linkedin\.com/i)
  const sub = m ? m[1].toLowerCase() : null
  if (sub && sub !== 'mx' && sub !== 'www') return true
  return !!detectForeignLocation(texts.filter(Boolean).join(' '))
}

/** True if `text` contains `token` or any of its bilingual synonyms. */
function hasTerm(text, token) {
  const group = SYNONYM_INDEX.get(token)
  if (!group) return text.includes(token)
  return group.some(w => text.includes(w))
}

/** Precompute the target signals from a vacancy once, reuse across prospects. */
export function buildTargets(vacancy = {}) {
  const titleTokens = [...new Set(tokenize(vacancy.title))]
  const compTokens = (vacancy.competencies || [])
    .filter(c => c && c.name)
    .map(c => ({ name: c.name, toks: tokenize(c.name).filter(w => w.length > 3) }))
    .filter(c => c.toks.length)
  const descTokens = [...new Set(tokenize(`${vacancy.description || ''} ${vacancy.department || ''} ${vacancy.challenges || ''}`))]
  const locToks = tokenize(vacancy.location || '')
  const titleNorm = normalizeText(vacancy.title || '')
  const wantsSenior = SENIOR_WORDS.some(w => titleNorm.includes(w))
  return { titleTokens, compTokens, descTokens, locToks, wantsSenior }
}

/**
 * Score one prospect against a vacancy.
 * @param prospect { title, current_title, current_company, snippet }
 * @returns { score, roleScore, matchedComps, matchedKeywords, locationMatch, strengths, gaps }
 */
export function scoreProspect(vacancy, prospect = {}, targets = null) {
  targets = targets || buildTargets(vacancy)
  const text = normalizeText(
    `${prospect.title || ''} ${prospect.current_title || ''} ${prospect.snippet || ''} ${prospect.current_company || ''}`
  )

  // 1. Role / title alignment (strongest signal — the headline). Bilingüe.
  const titleHits = targets.titleTokens.filter(t => hasTerm(text, t))
  const roleScore = targets.titleTokens.length ? titleHits.length / targets.titleTokens.length : 0

  // 2. Competencies present (bilingüe)
  const matchedComps = targets.compTokens.filter(c => c.toks.some(w => hasTerm(text, w))).map(c => c.name)
  const compScore = targets.compTokens.length ? matchedComps.length / targets.compTokens.length : 0

  // 3. Domain keywords from the description (saturates at 8 hits, bilingüe)
  const kwHits = targets.descTokens.filter(t => hasTerm(text, t))
  const kwScore = targets.descTokens.length ? Math.min(kwHits.length / Math.min(targets.descTokens.length, 8), 1) : 0

  // 4. Location — neutral (0.5) when the vacancy has no location set
  const locationMatch = targets.locToks.length ? targets.locToks.some(t => text.includes(t)) : false
  const locScore = targets.locToks.length ? (locationMatch ? 1 : 0) : 0.5

  let total = roleScore * 45 + compScore * 30 + kwScore * 15 + locScore * 10

  // El match debe venir (también) del PUESTO del candidato, no solo del
  // snippet: un abogado cuyo texto menciona "crédito hipotecario" no es un
  // asesor hipotecario. Si su headline/puesto no trae ninguna señal del rol,
  // se penaliza (reporte "perfiles basura" 2026-08-31).
  const ownTitle = normalizeText(`${prospect.title || ''} ${prospect.current_title || ''}`)
  const titleHasRole = targets.titleTokens.some(t => hasTerm(ownTitle, t))
  if (titleHits.length && !titleHasRole) total -= 12

  // Seniority nudge
  const isJunior = JUNIOR_WORDS.some(w => text.includes(w))
  const isSenior = SENIOR_WORDS.some(w => text.includes(w))
  if (targets.wantsSenior && isJunior) total -= 15
  else if (targets.wantsSenior && isSenior) total += 6

  // Perfil ubicado fuera de México → BLOQUEADO (score 0), salvo que la vacante
  // misma sea para ese país.
  const foreign = detectForeignLocation(text)
  const vacLoc = normalizeText(vacancy.location || '')
  const isForeign = foreign && !vacLoc.includes(foreign)
  if (isForeign) total = 0

  const score = Math.max(0, Math.min(Math.round(total), 100))

  // Human-readable rationale for the UI
  const strengths = []
  const gaps = []
  if (titleHits.length) strengths.push(`Puesto: ${titleHits.slice(0, 3).join(', ')}`)
  if (matchedComps.length) strengths.push(`Competencias: ${matchedComps.slice(0, 3).join(', ')}`)
  if (locationMatch) strengths.push('Ubicación coincide')
  if (targets.wantsSenior && isSenior) strengths.push('Seniority alineado')

  const missingTitle = targets.titleTokens.filter(t => !text.includes(t))
  if (missingTitle.length) gaps.push(`Sin señal de: ${missingTitle.slice(0, 3).join(', ')}`)
  const missingComps = targets.compTokens.map(c => c.name).filter(n => !matchedComps.includes(n))
  if (missingComps.length) gaps.push(`Competencias no vistas: ${missingComps.slice(0, 2).join(', ')}`)
  if (targets.wantsSenior && isJunior) gaps.push('Perfil parece junior')
  if (titleHits.length && !titleHasRole) gaps.push('Su puesto actual no coincide (match solo por descripción)')
  if (isForeign) gaps.push(`Ubicación fuera de México (${foreign})`)

  return {
    score,
    roleScore: Math.round(roleScore * 100),
    compScore: Math.round(compScore * 100),
    matchedComps,
    matchedKeywords: kwHits.slice(0, 5),
    locationMatch,
    strengths,
    gaps,
  }
}
