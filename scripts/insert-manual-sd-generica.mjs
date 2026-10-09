// Alta de perfiles buscados A MANO (web search 2026-10-08, Serper sin créditos)
// para "Socio Director / Consultor Financiero Senior" (genérica). Cada perfil
// fue revisado 1x1: persona real, ancla MX, fit emprendedor/comercial, sin
// seguros. Aun así se re-pasa el gate del motor como cinturón de seguridad y
// se deduplica contra el banco + descartados de la org.
// netlify dev:exec node scripts/insert-manual-sd-generica.mjs
import { getServiceClient } from '../netlify/functions/lib/supabase.mjs'
import { normalizeLinkedInUrl, nameLooksLikeRole, isForeignProfile, hasMexicoSignal } from '../src/lib/sourcingScore.js'
import { matchExcludedCompany } from '../src/lib/excludedCompanies.js'

const ORG = '0d7b85ac-a473-4ef4-8a36-4bcb0542aafc'
const VAC = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'

// [nombre, slug, rol, empresa, ciudad]
const PROFILES = [
  ['José Gabriel Andrade Andrade', 'josé-gabriel-andrade-andrade-48320b139', 'Socio Fundador', 'Home Leadership', 'Guadalajara'],
  ['Gerardo De la Mora Basáñez', 'gerardo-de-la-mora-basáñez-0a8b441b', 'CEO y Socio Fundador', 'helix Branding', 'Guadalajara'],
  ['Mónica Ramos Lamas', 'monica-ramos-lamas-b8872a164', 'Socio Fundador', 'Casa Marina Bienes Raíces', 'Guadalajara'],
  ['Joel Alejandro Hernández Lozano', 'joel-alejandro-hernández-lozano-33b06479', 'Socio Fundador', 'HOLD Marketing', 'Guadalajara'],
  ['Gustavo A. Guajardo Villarreal', 'gustavo-a-guajardo-villarreal-ggaf', 'Socio Director', 'GGAF Abogados', 'Guadalajara'],
  ['Guillermo Cambero', 'guillermocambero', 'Socio Fundador y Director', 'Cambero Abogados', 'Guadalajara'],
  ['Guillermo Enrique Ladino Trejo', 'guillermo-enrique-ladino-trejo-b81b98111', 'Socio Fundador y Director', 'HELT Abogados', 'Guadalajara'],
  ['Arturo Galván', 'arturo-galvan-683bb046', 'Director Comercial', 'Socio Max', 'Guadalajara'],
  ['Eduardo Caccia', 'eduardo-caccia-75345013', 'Socio Fundador', 'Mindcode', 'Guadalajara'],
  ['Raúl López', 'raúl-lópez-84976044', 'Director Comercial', 'Hospitales AZURA', 'Ciudad de México'],
  ['Carlos García Fernández', 'carlosgrcfdz', 'Director Comercial', '3XPERTOS Asesores', 'Ciudad de México'],
  ['César Romero Grajales', 'cesar-romero-grajales-directorcompras-directorcomercial', 'Director Comercial Sr', 'Tequila Centinela', 'Ciudad de México'],
  ['Sergio Regalado Álvarez', 'sergio-regalado-alvarez-64328764', 'Director Comercial', 'Santul Herramientas', 'Ciudad de México'],
  ['Rodolfo Márquez', 'rodolfo-marquez-82080a33', 'Director Comercial', 'Alimentos Sabor Latino', 'Ciudad de México'],
  ['Carlos Espinoza', 'carlos-espinoza-55174112', 'Director Comercial', 'Salsas Castillo', 'Ciudad de México'],
  ['Ervey González Plancarte', 'ervey-gonzález-plancarte-39991326', 'Director Comercial', 'Gulf Fuels México', 'Ciudad de México'],
  ['Pedro Gracián Terrazas', 'pedro-gracián-terrazas-4b31ab142', 'Socio Fundador', 'Tecno Urea', 'Monterrey'],
  ['Gabriel Montemayor', 'gabriel-montemayor-ba474540', 'Socio Fundador', 'GME Consultoría', 'Monterrey'],
  ['Fernando Aguirre', 'fernando-aguirre-13017577', 'Socio Fundador y Director General', 'Bauhaus Producciones', 'Monterrey'],
  ['Carlos Ortiz', 'carlos-ortiz-0a2602117', 'Socio Fundador', 'SAKI Soluciones de Ciudad', 'Monterrey'],
  ['César Augusto López Vázquez', 'cesarlopeznegocios', 'Fundador', 'Expansión Global México', 'Monterrey'],
  ['Gerardo Vidaurreta', 'gerardovidaurreta', 'Dueño', 'Xpert Business Franquicias', 'Querétaro'],
  ['Tulio Espinosa Rodríguez', 'tulio-espinosa-rodríguez-9768baa1', 'Dueño de Negocio', 'Nexxia', 'Querétaro'],
  ['Vicente Díaz Ruíz', 'vicentediazruiz', 'Dueño', 'Torni-Tex', 'Querétaro'],
  ['Fernando Almaraz', 'fernando-almaraz-9389078a', 'Dueño', 'Transportes Servín', 'Querétaro'],
  ['Maricruz Rodrigo', 'maricruz-rodrigo-7604371ba', 'Asesora Inmobiliaria', 'RBR Inmueble Siete', 'Querétaro'],
  ['José Antonio Guzmán Razo', 'antonioguzmanrazo', 'Especialista Comercial y Ventas', 'Grupo Consultor del Bajío', 'Querétaro'],
  ['Javier Sordia Salinas', 'javier-sordia-salinas-1ba87314a', 'Socio Fundador', 'Grupo COFINE', 'Monterrey'],
]

async function fetchUrls(sb, build) {
  const urls = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const r of data || []) if (r.url) urls.push(r.url)
    if (!data || data.length < 1000) break
  }
  return urls
}

async function main() {
  const sb = getServiceClient()
  const bank = await fetchUrls(sb, () => sb.from('sourcing_bank').select('url').eq('vacancy_id', VAC))
  const disc = await fetchUrls(sb, () => sb.from('sourcing_bank').select('url').eq('organization_id', ORG).eq('source', 'descartado'))
  const known = new Set([...bank, ...disc].map(normalizeLinkedInUrl))

  const rows = []
  for (const [name, slug, role, company, city] of PROFILES) {
    const url = `https://www.linkedin.com/in/${slug}`
    const title = `${name} - ${role} - ${company}`
    const snippet = `${role} en ${company} · Ubicación: ${city}, México · Perfil verificado a mano (búsqueda manual 2026-10-08, revisión 1x1).`
    if (known.has(normalizeLinkedInUrl(url))) { console.log(`  ya en banco/descartados: ${name}`); continue }
    if (nameLooksLikeRole(name)) { console.log(`  nombre-rol: ${name}`); continue }
    if (matchExcludedCompany(company, role, title, snippet, name)) { console.log(`  VETADO (sector): ${name} · ${company}`); continue }
    if (isForeignProfile(url, title, role, company, snippet, { name })) { console.log(`  extranjero: ${name}`); continue }
    if (!hasMexicoSignal(url, title, role, company, snippet)) { console.log(`  sin señal MX: ${name}`); continue }
    rows.push({
      organization_id: ORG, vacancy_id: VAC,
      title, url, display_url: `linkedin.com · ${city}`,
      snippet, platform: 'linkedin',
      full_name: name, current_title: role, current_company: company,
      source: 'auto-sourced', score: null, score_details: null,
      notes: 'Búsqueda manual (web) 2026-10-08 · filtro 1x1: fit emprendedor/comercial, ancla MX, sin seguros',
    })
  }
  console.log(`${rows.length} filas nuevas a insertar`)
  if (rows.length) {
    const { data, error } = await sb.from('sourcing_bank')
      .upsert(rows, { onConflict: 'vacancy_id,url', ignoreDuplicates: true }).select('id, full_name')
    if (error) throw new Error(error.message)
    console.log(`✓ insertados: ${(data || []).length}`)
    for (const d of data || []) console.log(`   + ${d.full_name}`)
  }
  const { count } = await sb.from('sourcing_bank').select('id', { count: 'exact', head: true })
    .eq('vacancy_id', VAC).neq('source', 'descartado').is('verify_status', null)
  console.log(`Visibles ahora en la vacante: ${count}`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
