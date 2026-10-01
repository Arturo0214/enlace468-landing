const r = await fetch('https://google.serper.dev/search', {
  method: 'POST',
  headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ q: 'site:linkedin.com/in dentista consultorio Guadalajara', gl: 'mx', hl: 'es', num: 10 }),
})
const j = await r.json().catch(() => null)
console.log('HTTP', r.status, j?.organic ? `${j.organic.length} resultados` : JSON.stringify(j).slice(0, 150))
