const k = process.env.UNIPILE_API_KEY || ''
const d = process.env.UNIPILE_DSN || ''
console.log('key: primeros 2 =', JSON.stringify(k.slice(0,2)), '· últimos 2 =', JSON.stringify(k.slice(-2)), '· largo =', k.length)
console.log('dsn =', JSON.stringify(d))
// probar crudo contra el DSN con la key tal cual
const r = await fetch(`https://${d.trim()}/api/v1/accounts`, { headers: { 'X-API-KEY': k.trim(), accept: 'application/json' } })
console.log('con .trim() → HTTP', r.status)
