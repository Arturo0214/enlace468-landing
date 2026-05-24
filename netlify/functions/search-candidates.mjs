// Netlify serverless function: searches LinkedIn profiles via multiple search engines
// with fallback rotation, randomized User-Agents, retry logic, and pagination support

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
]

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Fetch with retry and exponential backoff
async function fetchWithRetry(url, options, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) })
      if (res.ok || res.status < 500) return res
      // Server error - retry
    } catch (err) {
      if (attempt === maxRetries) throw err
    }
    await sleep(1000 * Math.pow(2, attempt)) // 1s, 2s, 4s
  }
  return null
}

// Extract LinkedIn profile URLs and metadata from raw HTML
function extractCandidatesFromHTML(html) {
  const candidates = []

  // Clean HTML for text extraction
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // Extract LinkedIn profile URLs
  const urlPattern = /https?:\/\/[a-z]{2,3}\.linkedin\.com\/in\/[a-z0-9\-_%]+/gi
  const urls = new Set()
  let match
  while ((match = urlPattern.exec(html)) !== null) {
    let url = match[0].split('?')[0].split('#')[0].replace(/\/$/, '')
    // Normalize to www.linkedin.com
    url = url.replace(/https?:\/\/[a-z]{2,3}\.linkedin\.com/, 'https://www.linkedin.com')
    if (!url.includes('login') && !url.includes('signup') && !url.includes('404') && !url.includes('jobs') && !url.includes('company')) {
      urls.add(url)
    }
  }

  for (const profileUrl of urls) {
    const slug = profileUrl.split('/in/')[1]
    if (!slug || slug.length < 3) continue

    let decodedSlug
    try { decodedSlug = decodeURIComponent(slug) } catch (e) { decodedSlug = slug }

    const nameParts = decodedSlug
      .split('-')
      .filter(p => p.length > 0 && !/^\d+$/.test(p) && !/^[a-f0-9]{6,}$/i.test(p))
      .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())

    if (nameParts.length < 2) continue
    const fullName = nameParts.slice(0, 4).join(' ')

    if (candidates.some(c => c.linkedin_url === profileUrl)) continue

    // Try to extract title/company from surrounding text
    let currentTitle = null
    let currentCompany = null

    const urlIdx = cleanHtml.indexOf(profileUrl)
    if (urlIdx > -1) {
      const surrounding = cleanHtml
        .substring(Math.max(0, urlIdx - 400), Math.min(cleanHtml.length, urlIdx + 400))
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      // Look for "Name - Title - Company | LinkedIn" or similar patterns
      const linkedinTitleMatch = surrounding.match(
        new RegExp(nameParts[0] + '[^|]*', 'i')
      )
      if (linkedinTitleMatch) {
        const titleStr = linkedinTitleMatch[0]
        const segments = titleStr.split(/\s*[-–—]\s*/).map(s => s.trim()).filter(s =>
          s.length > 1 &&
          !s.includes('LinkedIn') &&
          !s.includes('linkedin') &&
          !s.includes('<') &&
          !s.includes('>') &&
          !s.includes('svelte') &&
          !s.includes('class=') &&
          !s.includes('http') &&
          !s.includes('img') &&
          s.length < 80
        )
        if (segments.length >= 2) currentTitle = segments[1] || null
        if (segments.length >= 3) currentCompany = segments[2] || null
      }
    }

    // Clean any remaining HTML artifacts
    if (currentTitle && (currentTitle.includes('<') || currentTitle.includes('svelte') || currentTitle.includes('class'))) currentTitle = null
    if (currentCompany && (currentCompany.includes('<') || currentCompany.includes('svelte') || currentCompany.includes('class'))) currentCompany = null

    // Try to extract snippet
    let snippet = null
    if (urlIdx > -1) {
      const afterUrl = cleanHtml
        .substring(urlIdx, Math.min(cleanHtml.length, urlIdx + 600))
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      // Look for descriptive text that might be a snippet
      const snippetMatch = afterUrl.match(/(?:experience|experiencia|about|acerca|skills|habilidades|profile|perfil)[^.]{10,120}\./i)
      if (snippetMatch) snippet = snippetMatch[0].trim()
    }

    // Try to extract location
    let location = null
    if (urlIdx > -1) {
      const nearUrl = cleanHtml
        .substring(Math.max(0, urlIdx - 200), Math.min(cleanHtml.length, urlIdx + 500))
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
      const locMatch = nearUrl.match(/(?:ubicaci[oó]n|location|area|[áa]rea)[:\s]*([A-ZÁÉÍÓÚÑa-záéíóúñ\s,]{3,40}?)(?:\s*[-·|]|\s{2,}|$)/i)
      if (locMatch) location = locMatch[1].trim()
    }

    candidates.push({
      full_name: fullName,
      current_title: currentTitle,
      current_company: currentCompany,
      linkedin_url: profileUrl,
      snippet,
      location,
    })
  }

  return candidates
}

// Search engine definitions - each returns a URL to fetch
function buildSearchEngines(searchQuery, offset = 0) {
  const encoded = encodeURIComponent(searchQuery)
  // Randomize order each time for rotation
  const engines = [
    {
      name: 'DuckDuckGo',
      url: `https://html.duckduckgo.com/html/?q=${encoded}`,
      headers: { 'User-Agent': randomUA(), 'Accept': 'text/html', 'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8' },
    },
    {
      name: 'Brave',
      url: `https://search.brave.com/search?q=${encoded}&source=web${offset ? `&offset=${offset}` : ''}`,
      headers: { 'User-Agent': randomUA(), 'Accept': 'text/html', 'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8' },
    },
    {
      name: 'Bing',
      url: `https://www.bing.com/search?q=${encoded}&count=50${offset ? `&first=${offset + 1}` : ''}`,
      headers: { 'User-Agent': randomUA(), 'Accept': 'text/html', 'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8' },
    },
    {
      name: 'Google',
      url: `https://www.google.com/search?q=${encoded}&num=100&hl=es${offset ? `&start=${offset}` : ''}`,
      headers: { 'User-Agent': randomUA(), 'Accept': 'text/html', 'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8' },
    },
  ]
  // Shuffle the array for rotation
  for (let i = engines.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [engines[i], engines[j]] = [engines[j], engines[i]]
  }
  return engines
}

export async function handler(event) {
  const query = event.queryStringParameters?.q
  const offset = parseInt(event.queryStringParameters?.offset || '0', 10)
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (!query) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing q parameter' }) }
  }

  try {
    const searchQuery = `site:linkedin.com/in ${query}`
    const engines = buildSearchEngines(searchQuery, offset)
    let allCandidates = []
    const errors = []

    // Try each engine in order until we get results
    for (const engine of engines) {
      try {
        const response = await fetchWithRetry(engine.url, { headers: engine.headers })
        if (!response) {
          errors.push(`${engine.name}: no response`)
          continue
        }

        const html = await response.text()

        // Check if we got blocked (CAPTCHA, empty, or very short response)
        if (html.length < 500 || /captcha|unusual traffic|blocked|access denied/i.test(html)) {
          errors.push(`${engine.name}: blocked/captcha (${html.length} bytes)`)
          continue
        }

        const candidates = extractCandidatesFromHTML(html)

        if (candidates.length > 0) {
          // Merge results, dedup by linkedin_url
          const seen = new Set(allCandidates.map(c => c.linkedin_url))
          for (const c of candidates) {
            if (!seen.has(c.linkedin_url)) {
              allCandidates.push(c)
              seen.add(c.linkedin_url)
            }
          }
          // If we have a good number of results, stop trying more engines
          if (allCandidates.length >= 10) break
        } else {
          errors.push(`${engine.name}: 0 results from ${html.length} bytes`)
        }
      } catch (err) {
        errors.push(`${engine.name}: ${err.message}`)
      }
    }

    // If first pass got few results, try remaining engines that haven't been tried
    // (the loop above already handles this via the rotation)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        results: allCandidates.slice(0, 100),
        count: allCandidates.length,
        query: searchQuery,
        offset,
        ...(allCandidates.length === 0 && errors.length > 0 ? { debug: errors } : {}),
      }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message, results: [] }),
    }
  }
}
