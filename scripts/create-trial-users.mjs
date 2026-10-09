// Crea usuarios de PRUEBA con vencimiento (profiles.trial_expires_at).
// El trigger handle_new_user les crea el perfil (org Enlace 468, recruiter);
// aquí solo se les estampa el vencimiento y el nombre.
// Uso: TRIAL_USERS='correo:password:Nombre,correo2:pass2:Nombre2' TRIAL_DAYS=10 \
//        netlify dev:exec node scripts/create-trial-users.mjs
import { getServiceClient } from '../netlify/functions/lib/supabase.mjs'

const RAW = process.env.TRIAL_USERS || ''
const DAYS = parseInt(process.env.TRIAL_DAYS, 10) || 10
if (!RAW) { console.error('Falta TRIAL_USERS=correo:password:Nombre,...'); process.exit(1) }

async function main() {
  const sb = getServiceClient()
  const expires = new Date(Date.now() + DAYS * 24 * 3600 * 1000).toISOString()
  for (const spec of RAW.split(',')) {
    const [email, password, name] = spec.split(':').map(s => s.trim())
    const { data, error } = await sb.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: name || email.split('@')[0] },
    })
    if (error) { console.error(`✗ ${email}: ${error.message}`); continue }
    const uid = data.user.id
    const { error: pErr } = await sb.from('profiles')
      .update({ trial_expires_at: expires, full_name: name || null, role: 'recruiter' })
      .eq('id', uid)
    if (pErr) { console.error(`✗ perfil ${email}: ${pErr.message}`); continue }
    console.log(`✓ ${email} (${name}) · expira ${expires}`)
  }
  process.exit(0)
}
main().catch(e => { console.error(e); process.exit(1) })
