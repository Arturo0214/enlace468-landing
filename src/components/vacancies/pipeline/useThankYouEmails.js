import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../lib/auth'

// Estado y acciones del modal de email de agradecimiento a rechazados
// (ThankYouEmailModal): plantilla con {{nombre}}, envío desde plataforma
// (POST /api/send-email) y fallback mailto:. El estado vive en el padre para
// conservar el flujo original (la plantilla se regenera en openThankYouModal
// con el keepInBank vigente y el asunto editado persiste entre aperturas).
export function useThankYouEmails({ vacancyId, candidates }) {
  const { profile } = useAuth()
  const [showThankYouModal, setShowThankYouModal] = useState(false)
  const [thankYouSubject, setThankYouSubject] = useState('Agradecimiento por tu participación en nuestro proceso')
  const [thankYouBody, setThankYouBody] = useState('')
  const [keepInBank, setKeepInBank] = useState(true)
  const [sendingEmails, setSendingEmails] = useState(false)
  const [emailsSent, setEmailsSent] = useState(false) // fallback mailto: abierto
  const [sendResult, setSendResult] = useState(null) // { sent, skipped, failed, reason? } de /api/send-email
  const [sendError, setSendError] = useState(null)

  function openThankYouModal() {
    const vacTitle = candidates[0]?.vacancies?.title || 'la vacante'
    setThankYouBody(`Estimado/a {{nombre}},

Queremos agradecerte sinceramente por tu interés y participación en nuestro proceso de selección para la posición de ${vacTitle || 'esta posición'}.

Después de una evaluación cuidadosa, hemos decidido avanzar con otro perfil que se ajusta más a las necesidades actuales del puesto. Esta decisión no refleja tu valor profesional — tu experiencia y trayectoria son notables.

${keepInBank ? 'Con tu autorización, conservaremos tu perfil en nuestro banco de talento para futuras oportunidades que se alineen mejor con tu perfil. Si prefieres que eliminemos tus datos, solo responde a este correo indicándolo.' : ''}

Te deseamos mucho éxito en tu búsqueda profesional.

Cordialmente,
${profile?.full_name || 'El equipo de reclutamiento'}
Enlace 468`)
    setEmailsSent(false)
    setSendResult(null)
    setSendError(null)
    setShowThankYouModal(true)
  }

  // Bitácora local (timeline + activity) de los correos de agradecimiento —
  // compartida por el envío desde plataforma y el fallback mailto:.
  async function logThankYouInteractions(rejected) {
    for (const vc of rejected) {
      const c = vc.candidates
      const personalizedBody = thankYouBody.replace(/\{\{nombre\}\}/g, c.full_name?.split(' ')[0] || 'candidato/a')

      // Log as interaction
      await supabase.from('candidate_interactions').insert({
        vacancy_candidate_id: vc.id,
        type: 'email',
        content: `[Agradecimiento] ${thankYouSubject}\n\n${personalizedBody}`,
        direction: 'outbound',
        performed_by: profile.id,
      })

      // Log activity
      await supabase.from('activity_log').insert({
        organization_id: profile.organization_id,
        entity_type: 'vacancy_candidate',
        entity_id: vc.id,
        action: `Correo de agradecimiento enviado a ${c.full_name}`,
        details: { type: 'thank_you_email', keep_in_bank: keepInBank },
        performed_by: profile.id,
      })
    }
  }

  // Envío desde la plataforma (Resend vía /api/send-email): 1 email por
  // candidato con {{nombre}} personalizado — nada de BCC masivo.
  async function sendThankYouEmails() {
    setSendingEmails(true)
    setSendResult(null)
    setSendError(null)
    const rejected = candidates.filter(c => c.stage === 'rejected' && c.candidates?.email)

    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Tu sesión expiró — vuelve a iniciar sesión')

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: 'rejection_thanks',
          recipients: rejected.map(vc => ({
            email: vc.candidates.email,
            name: vc.candidates.full_name,
            candidate_id: vc.candidate_id || vc.candidates?.id,
            vacancy_candidate_id: vc.id,
          })),
          subject: thankYouSubject,
          body: thankYouBody,
          vacancy_id: vacancyId,
          organization_id: profile.organization_id,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || `Error ${res.status} al enviar`)

      setSendResult(data)
      // Bitácora solo si de verdad salió algo (si skip por falta de key, el
      // usuario decidirá si usa el fallback mailto:, que loggea por su cuenta).
      if (data.sent > 0) await logThankYouInteractions(rejected)
    } catch (e) {
      setSendError(e.message)
    }
    setSendingEmails(false)
  }

  // Fallback mailto: (flujo original) — abre el cliente de correo del usuario
  // con BCC masivo. Útil mientras no exista RESEND_API_KEY en Netlify.
  async function openThankYouMailto() {
    setSendingEmails(true)
    const rejected = candidates.filter(c => c.stage === 'rejected' && c.candidates?.email)

    await logThankYouInteractions(rejected)

    // Open mailto with BCC for mass send
    const emails = rejected.map(vc => vc.candidates?.email).filter(Boolean)
    if (emails.length > 0) {
      const mailto = `mailto:${profile?.email || ''}?bcc=${emails.join(',')}&subject=${encodeURIComponent(thankYouSubject)}&body=${encodeURIComponent(thankYouBody.replace(/\{\{nombre\}\}/g, 'estimado/a candidato/a'))}`
      window.open(mailto, '_blank')
    }

    setEmailsSent(true)
    setSendingEmails(false)
  }

  return {
    showThankYouModal, setShowThankYouModal, openThankYouModal,
    thankYouSubject, setThankYouSubject,
    thankYouBody, setThankYouBody,
    keepInBank, setKeepInBank,
    sendingEmails, emailsSent, sendResult, sendError,
    sendThankYouEmails, openThankYouMailto,
  }
}
