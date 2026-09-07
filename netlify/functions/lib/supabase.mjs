// Cliente Supabase service-role compartido por las Netlify Functions.
// OJO: en el runtime de functions los .env de Vite NO existen — la URL debe
// venir de SUPABASE_URL (netlify env:set); VITE_SUPABASE_URL queda como
// fallback para dev local con `netlify dev`.
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

let _client

/** Devuelve un cliente service-role memoizado (una instancia por cold start). */
export function getServiceClient() {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: { persistSession: false },
        realtime: { transport: ws },
      }
    )
  }
  return _client
}
