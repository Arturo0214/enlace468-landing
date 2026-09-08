import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useToast } from '../../../../lib/toast'

// Actividad de LinkedIn vía Unipile (invitaciones/conexiones/conversaciones),
// nuestro outreach registrado en el CRM, generación de drafts con IA y el
// envío real de conexiones/InMail (con confirmación previa).
export default function useOutreachActivity({ profile, vacancy, vacancyId, selectedCandidate }) {
  const toast = useToast()
  const [draftChannel, setDraftChannel] = useState('linkedin_message')
  const [draftLoading, setDraftLoading] = useState(false)
  const [draft, setDraft] = useState(null)
  const [draftCopied, setDraftCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)
  const [activity, setActivity] = useState({ invitations: [], connections: [], conversations: [], counts: {} })
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [ourOutreach, setOurOutreach] = useState([]) // envíos registrados por el CRM (sourcing_bank)
  // Carga las invitaciones enviadas por LinkedIn (Unipile) para el tablero.
  const [connectingAccount, setConnectingAccount] = useState(false)
  // Confirmación previa al envío por LinkedIn (reemplaza window.confirm).
  const [pendingSend, setPendingSend] = useState(null) // { cand, action, label }

  // Limpia el draft de IA al abrir otro candidato
  useEffect(() => { setDraft(null); setDraftCopied(false); setSendResult(null) }, [selectedCandidate])

  // Genera el link de Unipile y lo abre para conectar/cambiar la cuenta de LinkedIn.
  async function connectLinkedInAccount() {
    setConnectingAccount(true)
    try {
      const res = await fetch('/api/linkedin-connect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redirect_url: window.location.href }),
      })
      const data = await res.json()
      if (data.ok && data.url) window.open(data.url, '_blank', 'noopener')
      else toast.error(data.hint || 'No se pudo generar el link de conexión.')
    } catch (e) { toast.error('No se pudo conectar con el servicio.') }
    finally { setConnectingAccount(false) }
  }

  async function loadActivity() {
    setActivityLoading(true)
    try {
      const res = await fetch('/api/linkedin-activity')
      const data = await res.json()
      if (res.ok && data.ok) setActivity({ invitations: data.invitations || [], connections: data.connections || [], conversations: data.conversations || [], counts: data.counts || {} })
    } catch (e) { /* silencioso */ }
    finally { setActivityLoading(false) }
  }
  useEffect(() => { loadActivity() }, [])

  // Nuestro outreach registrado en el CRM (toda la organización, cualquier vacante)
  async function loadOurOutreach() {
    const orgId = profile?.organization_id
    if (!orgId) return
    const { data } = await supabase.from('sourcing_bank')
      .select('url, full_name, contact_status, contact_channel, contacted_at, contact_message, provider_id')
      .eq('organization_id', orgId).not('contact_status', 'is', null)
      .order('contacted_at', { ascending: false })
    setOurOutreach(data || [])
  }
  useEffect(() => { loadOurOutreach() }, [profile?.organization_id])

  const slugOfUrl = (url = '') => { const m = String(url).match(/\/in\/([^/?#]+)/i); return m ? decodeURIComponent(m[1]).toLowerCase() : '' }
  // Estado por candidato: usamos NUESTRO registro (invitado) + Unipile (conectado)
  const connectedSlugs = new Set(activity.connections.map(c => (c.public_id || '').toLowerCase()).filter(Boolean))
  const invitedSlugs = new Set(ourOutreach.map(o => slugOfUrl(o.url)).filter(Boolean))
  const contactStatus = (url) => { const s = slugOfUrl(url); return connectedSlugs.has(s) ? 'connected' : invitedSlugs.has(s) ? 'invited' : null }

  // Genera un mensaje de outreach personalizado con IA para un candidato.
  async function generateDraft(cand, channel) {
    setDraftLoading(true); setDraft(null); setDraftCopied(false)
    try {
      const res = await fetch('/api/outreach-draft', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: {
            full_name: cand.full_name, current_title: cand.current_title, current_company: cand.current_company,
            location: cand.location, snippet: cand.snippet,
          },
          vacancy: { title: vacancy.title, company_name: vacancy.company_name, location: vacancy.location, description: vacancy.description },
          channel, recruiter: profile?.full_name ? `${profile.full_name} · Enlace 468` : 'Enlace 468',
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setDraft({ error: data.hint || data.error || 'No se pudo generar.' }); return }
      setDraft({ subject: data.subject, body: data.body, channel })
    } catch (e) { setDraft({ error: 'No se pudo conectar con el generador.' }) }
    finally { setDraftLoading(false) }
  }

  function copyDraft() {
    if (!draft?.body) return
    const txt = (draft.subject ? `Asunto: ${draft.subject}\n\n` : '') + draft.body
    navigator.clipboard?.writeText(txt)
    setDraftCopied(true); setTimeout(() => setDraftCopied(false), 2000)
  }

  // Envía la conexión/InMail por LinkedIn vía Unipile (acción real, 1 clic).
  function sendLinkedIn(cand, action) {
    if (!cand?.linkedin_url) { setSendResult({ type: 'err', text: 'Este candidato no tiene URL de LinkedIn.' }); return }
    if (!draft?.body) { setSendResult({ type: 'err', text: 'Genera un mensaje primero.' }); return }
    const label = action === 'inmail' ? 'InMail' : 'solicitud de conexión'
    setPendingSend({ cand, action, label })
  }

  // Ejecuta el envío una vez confirmado en el diálogo.
  async function doSendLinkedIn() {
    const { cand, action, label } = pendingSend || {}
    if (!cand) return
    setPendingSend(null)
    setSending(true); setSendResult(null)
    try {
      const res = await fetch('/api/linkedin-send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cand.linkedin_url, message: draft.body, subject: draft.subject, action }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) { setSendResult({ type: 'err', text: data.hint || data.error || 'No se pudo enviar.' }); return }
      if (data.alreadyConnected) { setSendResult({ type: 'ok', text: `${data.name} ya es tu contacto — mándale mensaje directo.` }); return }
      setSendResult({ type: 'ok', text: `✓ ${label} enviada a ${data.name || cand.full_name} por LinkedIn.` })
      // Registra el contacto en el banco (upsert) → tablero + no se re-contacta
      try {
        const row = {
          organization_id: profile.organization_id, vacancy_id: vacancyId,
          url: cand.linkedin_url, title: cand.full_name || data.name, full_name: cand.full_name || data.name,
          current_title: cand.current_title || null, current_company: cand.current_company || null,
          display_url: 'linkedin.com', snippet: cand.snippet || null, platform: 'linkedin', source: 'sourced',
          created_by: profile.id,
          contact_status: action === 'inmail' ? 'inmail_sent' : 'invited',
          contact_channel: draft.channel, contacted_at: new Date().toISOString(),
          contact_message: draft.body, provider_id: data.providerId || null,
          invitation_id: data.result?.invitation_id || null,
          // Solo si el candidato trae score (auto-source); condicional para no
          // pisar con null un score ya guardado (este upsert SÍ sobreescribe).
          ...(typeof cand.score === 'number'
            ? { score: cand.score, score_details: cand.score_details || { strengths: cand.strengths || [], gaps: cand.gaps || [] } }
            : {}),
        }
        await supabase.from('sourcing_bank').upsert(row, { onConflict: 'vacancy_id,url' })
        loadOurOutreach()
      } catch (e) { console.error('registro outreach:', e) }
      loadActivity() // refresca el estado de LinkedIn
    } catch (e) { setSendResult({ type: 'err', text: 'No se pudo conectar con LinkedIn.' }) }
    finally { setSending(false) }
  }

  return {
    // estado
    draftChannel, setDraftChannel, draftLoading, draft, draftCopied,
    sending, sendResult, activity, activityLoading, activityOpen, setActivityOpen,
    ourOutreach, connectingAccount, pendingSend, setPendingSend,
    slugOfUrl, connectedSlugs, invitedSlugs, contactStatus,
    // acciones
    connectLinkedInAccount, loadActivity, generateDraft, copyDraft,
    sendLinkedIn, doSendLinkedIn,
  }
}
