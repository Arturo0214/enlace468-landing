// Alta manual (WebSearch 2026-10-13, Serper sin créditos) para "Socio director"
// 3a8abc52. Gate de seguridad + dedupe contra las 4 vacantes Socio Director y
// descartados de la org (misma persona NO debe vivir en dos vacantes hermanas).
import { getServiceClient } from '../netlify/functions/lib/supabase.mjs'
import { normalizeLinkedInUrl, nameLooksLikeRole, isForeignProfile, hasMexicoSignal } from '../src/lib/sourcingScore.js'
import { matchExcludedCompany } from '../src/lib/excludedCompanies.js'

const ORG = '0d7b85ac-a473-4ef4-8a36-4bcb0542aafc'
const VAC = '3a8abc52-4452-4772-aa16-d3072e4ad686'
const SD_VACS = [VAC, 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', 'c596fba3-790c-4ba1-9341-1d295514cffe', '63ca7468-e58f-4d2f-935c-5c9cdfce8b74']

const PROFILES = [
  ['Cesar Romero Grajales','cesar-romero-grajales-directorcompras-directorcomercial','Director Comercial Sr','Tequila Centinela','Ciudad de México'],
  ['Rodolfo Marquez','rodolfo-marquez-82080a33','Director Comercial','Alimentos Sabor Latino','Ciudad de México'],
  ['Ervey González Plancarte','ervey-gonzález-plancarte-39991326','Director Comercial','Gulf Fuels México','Ciudad de México'],
  ['Victor García','víctor-garcía','Director Comercial','Tiendas 3B','Ciudad de México'],
  ['Felipe Diaz de Leon','felipe-diaz-de-leon-33b5448','Director General','Gran Ciudad','Ciudad de México'],
  ['Alvaro Miranda','alvaro-mirandao','Director Comercial','Accel Logística','Ciudad de México'],
  ['Nicolas Beja','nicolas-beja-0337a81a','Promotor y Desarrollador Inmobiliario','Desarrollo propio','Ciudad de México'],
  ['Jorge S. Chong Gutiérrez','jorge-s-chong-gutiérrez-65906637','Socio Fundador','Ruiz de Chavez & Chong Abogados','Ciudad de México'],
  ['Armando Madrigal Albarran','armando-madrigal-albarran-director-general','Director General','Aktika Consulting','Ciudad de México'],
  ['Eduardo Garduño','eduardo-garduño-226517195','Socio Fundador','DeForest Abogados','Puebla'],
  ['Juan Pablo Castañeda','juanpcastaneda','Socio Fundador y CEO','CEMAVIS S.C.','Puebla'],
  ['Guillermo Gasca Zavala','guillermo-gasca-zavala-b28a1323','Director Comercial','International México','Puebla'],
  ['Alejandro Castañon A','alejandro-castañon-a-879a9a49','Gerente General','GEN Toluca','Toluca'],
  ['German Gallardo','german-gallardo-342120202','Gerente General','LT Empresarial SA de CV','Toluca'],
  ['Jorge Eduardo Hernández Camacho','jorge-eduardo-hernández-camacho-35b65a168','Gerente General','Servicios Galabria SA de CV','Toluca'],
  ['Luis Fernando Luna Hernández','luisfernandoluna','Director Comercial','Banco Forjadores SA','Toluca'],
  ['Gonzalo Camacho','gonzalo-camacho-b9b29a74','Director Comercial','Europcar México','Toluca'],
  ['Waldo Salgado','waldo-salgado-45ab1a43','Gerente General','Tysa de México SA de CV','Toluca'],
  ['Luis Adrian Bracamontes','nonwovens','Director General','Tecnología y no Tejidos','Cuernavaca'],
  ['Jaime L. Aguilar Astiazaran','jaime-l-aguilar-astiazaran-a09641106','Director General','ThinkSmart México','Cuernavaca'],
  ['Giuseppe Talarico','giuseppe-talarico-20a95b138','Director General','Radiología y Electrónica de México','Cuernavaca'],
  ['Donovan Gabriel Espinosa Oliva','donovan-gabriel-espinosa-oliva-93150011b','Director General','FRICCSA Refrigeración','Cuernavaca'],
  ['Oscar Zubiría','oscarzubiria','Director Comercial','BYD Trucks','Cuernavaca'],
  ['Jorge Septien','jorge-septien-9250286','CEO','MSPV Seguridad Privada SA de CV','Cuernavaca'],
  ['Luis Enrique Cruz Jimenez','luis-enrique-cruz-jimenez-18b57b17a','Gerente General','VW Z Motors de México','Pachuca'],
  ['Ricardo Enriquez Muñoz','ricardo-enriquez-muñoz-abb5a8b7','Socio Fundador y Gerente General','Capital Solution','Pachuca'],
  ['Jacobo Mizrahi','jacobo-mizrahi-726458a4','Director General','Linoleums 21','Pachuca'],
  ['Guillermo Gutierrez','memogutierrez','Director Comercial','CEDEM Centro de Dueñez Empresaria','Guadalajara'],
  ['Juan Pablo Sánchez García','jpablo-consultor','Socio Fundador','Instituto Mexicano de Consultores en DO','Guadalajara'],
  ['Edgar López','edgar-lópez-b6a9217a','Socio Director','Asesores de Consejo y Alta Dirección AC','Guadalajara'],
  ['Pablo Zamora','pablozamoral','Socio Director','Networking de México','Guadalajara'],
  ['Jorge Torres Zavala','jorge-torres-zavala-134a725b','Director General','SYNTROPY Servicios de Comunicaciones','Guadalajara'],
  ['Rodrigo Gallardo','rodrigo-gallardo-87084a182','Director General','Consorcio Inmobiliario Tabachines','Guadalajara'],
  ['Edgar Cruz y Zepeda','edgar-cruz-y-zepeda-88086884','Director General','Viniflexi de México','Guadalajara'],
  ['Alfonso Gasca Sánchez','alfonso-gasca-sánchez-b661b336','Director General','Corporativo Gasca Consultores','Guadalajara'],
  ['Leopoldo Lara','leopoldo-lara-87340838','Socio Fundador','CRS Corporate & Real Estate Solutions','Querétaro'],
  ['Iñigo Alday','inigoalday','Managing Director','Irizar México','Querétaro'],
  ['Gerardo Carmona Ruiz','gerardocarmonar','Owner y CEO','Cero Design Group','Querétaro'],
  ['Roby Peñacastro','robertopenacastroortega','CEO y Fundador','Leadsales','Querétaro'],
  ['Francisco Camarillo','francisco-camarillo-02aabb72','Director General','Grupo Mexicano de Suelos','Aguascalientes'],
  ['Guadalupe Tenorio H.','c-p-c-guadalupe-tenorio-h-a7a50b55','Socio Fundador','Soluciones Alternativas en Administración','Aguascalientes'],
  ['Francisco Flores G.','franciscofloresg','Socio Fundador','ARC Group Ventures / Klee Real Estate','Aguascalientes'],
  ['Fernando Valadez','fernando-valadez-64b499125','Dueño','Soluciones Eléctricas y de Fontanería','Aguascalientes'],
  ['Salvador Aliseda','salvador-aliseda-56857bb6','Director Comercial','Corporativo ITP','San Luis Potosí'],
  ['José Luis Sanchez','josé-luis-sanchez-a0199232','Director Comercial','SAI-TECH SA de CV','San Luis Potosí'],
  ['Luis Gabriel Nunez Acosta','luis-gabriel-nunez-acosta-822326b1','Director Comercial','PRINTEA México','San Luis Potosí'],
  ['Jair Torres','jair-torres-53788258','Director Comercial','Tecnologistik','San Luis Potosí'],
  ['Jorge Iván Rodríguez Zamarripa','jorge-iván-rodríguez-zamarripa-20ba7811','Director Comercial','On Tecnología & Servicios','San Luis Potosí'],
  ['Jorge Eduardo González Estrella','jorge-eduardo-gonzález-estrella-6555b314b','Director Comercial','Procesos Húmedos de León','León'],
  ['Luis Fernando Mercado Ballesteros','luis-fernando-mercado-ballesteros-176a78159','Director Comercial','Servicios financieros (ex Telmex)','León'],
  ['Miguel Leon','miguel-leon-5a32ba55','Director Comercial','Biznet Norteamérica','León'],
  ['Salvador Gaytan Martinez','salvador-gaytan-martinez-81725697','Gerente General','Tecnología y Servicios','Morelia'],
  ['Victor M Ovando Huerta','victor-m-ovando-huerta-3a974839','Gerente General de Operaciones','Grupo Posadas','Morelia'],
  ['Sergio Gonzalez Montalvo','sergio-gonzalez-montalvo-435297139','Director Comercial','Medrano Magnetics SA de CV','Monterrey'],
  ['Gerardo Tovar Pérez','gerardo-tovar-pérez-660644b5','Director Comercial','—','San Nicolás de los Garza'],
  ['Edgar Abrego','edgar-abrego-69a3a9a8','Director Comercial','Creditaria México','Monterrey'],
  ['Alberto De La Garza Alcorta','alberto-de-la-garza-alcorta-4147b447','Director Comercial y de Mercadotecnia','Arca Continental','Monterrey'],
  ['Alexander Lobo','alexander-lobo-21471318','Socio Director','Centro de Desarrollo de Coaching','Monterrey'],
  ['Oscar Castillo Gutiérrez','oscar-castillo-gutiérrez-392b9181','Socio Director','Century 21 SiNow','Monterrey'],
  ['Ricardo Alcala Suro','ricardoalcalasuro','Socio Fundador','SUROTEL / Visitapp','Monterrey'],
  ['David Estrello','david-e-estrello-94794910','Socio Fundador y Director General','Uptrend / marketXL','Monterrey'],
  ['Freddy Morales','freddy-morales-478269174','Gerente General','Fiesta Americana Cancún Villas','Cancún'],
  ['Eduardo Rojas','eduardorojasvergara','Gerente General','Hyatt Zilara Cancún','Cancún'],
  ['Jose Luis Martinez Montiel','jose-luis-martinez-montiel-9309a9183','Gerente General','Club Med','Cancún'],
  ['Oscar Santos','oscar-santos-77a028b2','Socio Fundador','Santos & Becker Consulting','Mérida'],
  ['Jesús Mandujano López','jesusmandujanolopez','Director General y Socio Fundador','ANIFE','Mérida'],
  ['Daniel Arturo Duarte Rojo','daniel-arturo-duarte-rojo-23617122','Director General','Laboratorios Clínicos de Mérida','Mérida'],
  ['Santiago Soto López','santiago-soto-lópez-402951b9','Director General','Empresa propia','Hermosillo'],
  ['Herminio Quintero','herminio-quintero-8675b6a5','Director Comercial','QUINVAL SA de CV','Hermosillo'],
  ['Octavio Herrera','octavio-herrera-23463b35','CEO','Intercom Logistics','Chihuahua'],
  ['Rodolfo Lojero','rodolfo-lojero-2a467918a','Gerente General','Automotriz Toy (Toyota Veracruz)','Veracruz'],
  ['Verónica Alvarado','veronicalvarado','Gerente General','Toyota Veracruz y Riviera Veracruzana','Veracruz'],
  ['Javier Jaurena','javier-jaurena-9a4b0a1aa','Director General','JAUFER SA DE CV','Veracruz'],
  ['Abraham Cisneros','abraham-cisneros-20664368','Gerente General','Power and Control Consulting','Orizaba'],
  ['Santiago Velazquez','santiago-velazquez-92a915a6','Gerente General','Agroproductos de la Saucede','Veracruz'],
  ['Gerardo Gustavo Tamayo Sobera','gerardo-gustavo-tamayo-sobera-86b47626a','Director General','SUMIMSA','Tampico'],
  ['Jorge Tamayo S','jorge-tamayo-s-2bb9b846','Director General','TASO COMERCIAL SA DE CV','Tampico'],
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
  let known = []
  for (const v of SD_VACS) known.push(...await fetchUrls(sb, () => sb.from('sourcing_bank').select('url').eq('vacancy_id', v)))
  known.push(...await fetchUrls(sb, () => sb.from('sourcing_bank').select('url').eq('organization_id', ORG).eq('source', 'descartado')))
  const knownSet = new Set(known.map(normalizeLinkedInUrl))
  const seen = new Set()
  const rows = []
  for (const [name, slug, role, company, city] of PROFILES) {
    const url = `https://www.linkedin.com/in/${slug}`
    const canon = normalizeLinkedInUrl(url)
    const title = `${name} - ${role} - ${company}`
    const snippet = `${role} en ${company} · Ubicación: ${city}, México · Perfil verificado a mano (búsqueda manual 2026-10-13, revisión 1x1).`
    if (seen.has(canon)) { console.log(`  dup en lote: ${name}`); continue }
    seen.add(canon)
    if (knownSet.has(canon)) { console.log(`  ya en banco SD/descartados: ${name}`); continue }
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
      notes: 'Búsqueda manual (web) 2026-10-13 · filtro 1x1: fit socio director/comercial senior, ancla MX, sin seguros',
    })
  }
  console.log(`${rows.length} filas nuevas a insertar`)
  if (rows.length) {
    const { data, error } = await sb.from('sourcing_bank')
      .upsert(rows, { onConflict: 'vacancy_id,url', ignoreDuplicates: true }).select('id')
    if (error) throw new Error(error.message)
    console.log(`✓ insertados: ${(data || []).length}`)
  }
  const { count } = await sb.from('sourcing_bank').select('id', { count: 'exact', head: true })
    .eq('vacancy_id', VAC).neq('source', 'descartado').is('verify_status', null)
  console.log(`VISIBLES_AHORA: ${count}`)
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
