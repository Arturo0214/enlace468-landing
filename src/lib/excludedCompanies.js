// ---------------------------------------------------------------------------
// Company exclusion list for candidate sourcing — client request 2026-07.
//
// Never source candidates that currently work at these insurance / investment
// firms. Matching is by COMPANY NAME + variants (NOT the generic word
// "seguros"), so the finance/insurance search templates keep returning results.
//
// Shared by both sourcing surfaces:
//   - netlify/functions/search-candidates.mjs  (X-ray LinkedIn search)
//   - src/components/vacancies/SourcingTab.jsx (per-vacancy Google CSE search)
//
// `patterns` are pre-normalized (lowercase, no accents) and matched with word
// boundaries so short acronyms (AXA, GBM, GNP) don't hit substrings like
// "oaxaca". Add a firm here and it is excluded everywhere.
// ---------------------------------------------------------------------------
export const EXCLUDED_COMPANIES = [
  // --- Explicitly requested by the client ---
  { label: 'GNP', named: true, patterns: ['gnp', 'grupo nacional provincial'] },
  { label: 'Seguros Monterrey New York Life (SMNYL)', named: true, patterns: ['smnyl', 'seguros monterrey', 'monterrey new york life', 'new york life'] },
  { label: 'AXA', named: true, patterns: ['axa'] },
  { label: 'MetLife', named: true, patterns: ['metlife', 'met life'] },
  { label: 'Mapfre', named: true, patterns: ['mapfre'] },
  { label: 'Inbursa', named: true, patterns: ['inbursa'] },
  { label: 'Actinver', named: true, patterns: ['actinver'] },
  { label: 'GBM', named: true, patterns: ['gbm', 'grupo bursatil mexicano'] },
  // --- Other major insurers / investment firms (sector catch-all) ---
  { label: 'Qualitas', patterns: ['qualitas'] },
  { label: 'Sura', patterns: ['sura'] },
  { label: 'Zurich', patterns: ['zurich'] },
  { label: 'Allianz', patterns: ['allianz'] },
  { label: 'Chubb', patterns: ['chubb'] },
  { label: 'HDI Seguros', patterns: ['hdi seguros'] },
  { label: 'Seguros Banorte', patterns: ['seguros banorte', 'banorte seguros'] },
  { label: 'Afirme Seguros', patterns: ['afirme seguros'] },
  { label: 'Atlas Seguros', patterns: ['atlas seguros'] },
  { label: 'Prudential', patterns: ['prudential'] },
  { label: 'Principal', patterns: ['principal financial', 'principal seguros', 'principal afore'] },
  { label: 'Old Mutual / Skandia', patterns: ['old mutual', 'skandia'] },
  { label: 'Thona Seguros', patterns: ['thona'] },
  // Afores / retirement
  { label: 'Profuturo', patterns: ['profuturo'] },
  { label: 'Afore XXI Banorte', patterns: ['afore xxi', 'xxi banorte'] },
  { label: 'Afore Coppel', patterns: ['afore coppel'] },
  { label: 'PensionISSSTE', patterns: ['pensionissste'] },
  // Casas de bolsa / investment
  { label: 'Vector Casa de Bolsa', patterns: ['vector casa de bolsa'] },
  { label: 'Monex', patterns: ['monex'] },
  { label: 'Kuspit', patterns: ['kuspit'] },
  { label: 'Valmex / Value', patterns: ['valmex', 'value casa de bolsa'] },
  { label: 'Finamex', patterns: ['finamex'] },
  { label: 'Intercam', patterns: ['intercam'] },
  { label: 'Bursametrica', patterns: ['bursametrica'] },
  // --- Sector-wide catch-all (client request 2026-07): exclude ANYONE working
  // at an insurance or investment employer, not just the named firms above.
  // Tokens describe the EMPLOYER TYPE (aseguradora, casa de bolsa, afore...),
  // NOT a generic skill word like "seguros"/"inversiones" — so a strong finance
  // candidate isn't dropped merely for listing insurance as an area of expertise.
  { label: 'Sector asegurador', patterns: ['aseguradora', 'compania de seguros', 'compania aseguradora', 'grupo asegurador', 'grupo financiero asegurador', 'seguros y fianzas', 'reaseguradora', 'reaseguros', 'afianzadora'] },
  { label: 'Sector inversiones', patterns: ['casa de bolsa', 'operadora de fondos', 'operadora de sociedades de inversion', 'sociedad de inversion', 'gestora de fondos', 'fondo de inversion', 'afore', 'administradora de fondos para el retiro'] },
]

/** Lowercase + strip accents so matching is diacritic-insensitive. */
export function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Precompiled word-boundary matchers for every pattern.
const EXCLUDE_MATCHERS = EXCLUDED_COMPANIES.flatMap(c =>
  c.patterns.map(p => ({ label: c.label, re: new RegExp(`\\b${escapeRegex(normalizeText(p))}\\b`) }))
)

/**
 * Returns the excluded company label if any of the given text fragments
 * (company, title, snippet, name, surrounding context) reference an excluded
 * firm, otherwise null.
 */
export function matchExcludedCompany(...fragments) {
  const text = normalizeText(fragments.filter(Boolean).join('  '))
  if (!text) return null
  for (const m of EXCLUDE_MATCHERS) {
    if (m.re.test(text)) return m.label
  }
  return null
}

/** Negative search operators for the explicitly-named firms (keeps query short). */
export const NEGATIVE_QUERY = EXCLUDED_COMPANIES
  .filter(c => c.named)
  .map(c => `-"${c.label.replace(/\s*\(.*\)\s*/, '').trim()}"`)
  .join(' ')

/** Short human-readable list of the named firms, for UI notes. */
export const EXCLUDED_LABELS_SHORT = 'GNP, SMNYL, AXA, MetLife, Mapfre, Inbursa, Actinver, GBM'
