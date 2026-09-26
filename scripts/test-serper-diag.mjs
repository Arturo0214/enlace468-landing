import { serperSearch } from '../netlify/functions/auto-source.mjs'
const q = 'site:linkedin.com/in Gerente Comercial Monterrey'
const p1 = await serperSearch(q)
console.log('pag 1:', p1 === null ? 'NULL' : `${p1.length} perfiles`, p1?.[0]?.url || '')
const p2 = await serperSearch(q, 10, 2)
console.log('pag 2:', p2 === null ? 'NULL (free no pagina — ok, cae a scraping)' : `${p2.length} perfiles`, p2?.[0]?.url || '')
const p1b = await serperSearch(q)  // confirmar que serperBlocked NO quedó activado
console.log('pag 1 de nuevo (flag no activado):', p1b === null ? 'NULL — MAL' : `${p1b.length} perfiles — OK`)
