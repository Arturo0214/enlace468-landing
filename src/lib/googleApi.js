/**
 * Google API helpers — Gmail & Calendar
 * Uses the OAuth provider_token from Supabase Google login
 * All calls go directly from browser to Google APIs (no backend needed)
 */

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

function headers(token) {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
}

// --- Gmail ---

/**
 * Search Gmail for Fireflies emails
 * Returns list of meeting summaries
 */
export async function getFirefliesEmails(token, maxResults = 15) {
  // Search for emails from Fireflies
  const query = 'from:fred@fireflies.ai OR from:notifications@fireflies.ai OR subject:fireflies'
  const res = await fetch(
    `${GMAIL_BASE}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: headers(token) }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gmail API error: ${res.status}`)
  }

  const data = await res.json()
  if (!data.messages?.length) return []

  // Fetch each email's details
  const emails = await Promise.all(
    data.messages.map(m => getEmailDetail(token, m.id))
  )

  return emails.filter(Boolean)
}

async function getEmailDetail(token, messageId) {
  const res = await fetch(
    `${GMAIL_BASE}/messages/${messageId}?format=full`,
    { headers: headers(token) }
  )
  if (!res.ok) return null
  const msg = await res.json()

  const getHeader = (name) => msg.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''

  const subject = getHeader('Subject')
  const from = getHeader('From')
  const date = getHeader('Date')

  // Extract body text
  let body = ''
  function extractText(part) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      body += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
    }
    if (part.parts) part.parts.forEach(extractText)
  }
  if (msg.payload) extractText(msg.payload)

  // If no plain text, try HTML
  if (!body) {
    function extractHtml(part) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
        // Strip HTML tags for plain text
        body += html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ')
      }
      if (part.parts) part.parts.forEach(extractHtml)
    }
    if (msg.payload) extractHtml(msg.payload)
  }

  // Parse Fireflies email content
  const parsed = parseFirefliesEmail(subject, body)

  return {
    id: messageId,
    subject,
    from,
    date: new Date(date),
    body: body.slice(0, 2000), // limit size
    ...parsed,
  }
}

function parseFirefliesEmail(subject, body) {
  const result = {
    meetingTitle: '',
    attendees: [],
    summary: '',
    actionItems: [],
    duration: '',
    firefliesUrl: '',
  }

  // Meeting title — usually in subject
  result.meetingTitle = subject
    .replace(/\[Fireflies\.ai\]/i, '')
    .replace(/Meeting notes?:?\s*/i, '')
    .replace(/Notas de reunion:?\s*/i, '')
    .trim()

  // Fireflies URL
  const urlMatch = body.match(/https:\/\/app\.fireflies\.ai\/[^\s"<>)]+/)
  if (urlMatch) result.firefliesUrl = urlMatch[0]

  // Duration
  const durationMatch = body.match(/(?:duration|duracion|lasted)[:\s]*(\d+)\s*(?:min|minutes|minutos)/i)
  if (durationMatch) result.duration = `${durationMatch[1]} min`

  // Attendees — look for email addresses or "Participants" section
  const emailMatches = body.match(/[\w.-]+@[\w.-]+\.\w+/g)
  if (emailMatches) {
    result.attendees = [...new Set(emailMatches.filter(e =>
      !e.includes('fireflies') && !e.includes('unsubscribe') && !e.includes('noreply')
    ))]
  }

  // Try to extract names from "Participants" or "Attendees" section
  const participantsMatch = body.match(/(?:participants?|attendees?|asistentes?)[:\s]*([^\n]+)/i)
  if (participantsMatch) {
    const names = participantsMatch[1].split(/[,;]/).map(n => n.trim()).filter(n => n.length > 2 && n.length < 50)
    if (names.length > 0) result.attendees = [...new Set([...result.attendees, ...names])]
  }

  // Summary — look for "Summary" or "Overview" section
  const summaryMatch = body.match(/(?:summary|overview|resumen|notas)[:\s]*\n?([\s\S]{10,500}?)(?=\n\n|action items?|keywords|$)/i)
  if (summaryMatch) result.summary = summaryMatch[1].trim().slice(0, 500)

  // Action items
  const actionMatch = body.match(/(?:action items?|tareas|pendientes)[:\s]*\n?([\s\S]{10,500}?)(?=\n\n|keywords|$)/i)
  if (actionMatch) {
    result.actionItems = actionMatch[1]
      .split(/\n|•|[-*]/)
      .map(item => item.trim())
      .filter(item => item.length > 5 && item.length < 200)
      .slice(0, 10)
  }

  // If no structured summary, use first meaningful chunk of body
  if (!result.summary && body.length > 50) {
    result.summary = body.slice(0, 300).trim()
  }

  return result
}

/**
 * Match a Fireflies email to a candidate by name
 */
export function matchEmailToCandidate(email, candidateName) {
  if (!candidateName) return false
  const nameLower = candidateName.toLowerCase()
  const nameParts = nameLower.split(' ').filter(p => p.length > 2)

  // Check subject
  const subjectLower = (email.subject || '').toLowerCase()
  if (nameParts.some(p => subjectLower.includes(p))) return true

  // Check attendees
  const attendeesStr = (email.attendees || []).join(' ').toLowerCase()
  if (nameParts.some(p => attendeesStr.includes(p))) return true

  // Check meeting title
  const titleLower = (email.meetingTitle || '').toLowerCase()
  if (nameParts.some(p => titleLower.includes(p))) return true

  // Check body (first 500 chars)
  const bodyLower = (email.body || '').slice(0, 500).toLowerCase()
  if (nameParts.filter(p => bodyLower.includes(p)).length >= 2) return true

  return false
}

// --- Calendar ---

/**
 * Get upcoming/recent calendar events
 */
export async function getCalendarEvents(token, daysBack = 30, daysForward = 14) {
  const now = new Date()
  const timeMin = new Date(now.getTime() - daysBack * 86400000).toISOString()
  const timeMax = new Date(now.getTime() + daysForward * 86400000).toISOString()

  const res = await fetch(
    `${CALENDAR_BASE}/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=50&singleEvents=true&orderBy=startTime`,
    { headers: headers(token) }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Calendar API error: ${res.status}`)
  }

  const data = await res.json()
  return (data.items || []).map(ev => ({
    id: ev.id,
    title: ev.summary || '',
    start: ev.start?.dateTime || ev.start?.date,
    end: ev.end?.dateTime || ev.end?.date,
    attendees: (ev.attendees || []).map(a => ({ email: a.email, name: a.displayName, status: a.responseStatus })),
    meetLink: ev.hangoutLink || ev.conferenceData?.entryPoints?.[0]?.uri || '',
    description: ev.description || '',
    status: ev.status,
  }))
}

/**
 * Match a calendar event to a candidate
 */
export function matchEventToCandidate(event, candidateName) {
  if (!candidateName) return false
  const nameLower = candidateName.toLowerCase()
  const nameParts = nameLower.split(' ').filter(p => p.length > 2)

  // Check event title
  const titleLower = (event.title || '').toLowerCase()
  if (nameParts.some(p => titleLower.includes(p))) return true

  // Check attendees
  const attendeeStr = (event.attendees || []).map(a => `${a.name || ''} ${a.email || ''}`).join(' ').toLowerCase()
  if (nameParts.some(p => attendeeStr.includes(p))) return true

  return false
}
