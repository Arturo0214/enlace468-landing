import { getUnipileConfig, createUnipile } from '../netlify/functions/lib/unipile.mjs'
const cfg = getUnipileConfig()
const { getJson } = createUnipile(cfg)
const { ok, data } = await getJson('/accounts')
if (!ok) { console.log('error:', JSON.stringify(data).slice(0, 200)); process.exit(0) }
for (const a of data.items || []) {
  console.log(`tipo: ${a.type} · nombre: ${a.name || '?'} · id: ${a.id} · ${a.id === process.env.UNIPILE_ACCOUNT_ID ? '← CUENTA ACTIVA DEL RUNNER' : ''}`)
}
