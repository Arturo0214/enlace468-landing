// Netlify serverless function: searches LinkedIn profiles via Brave Search

export async function handler(event) {
  const query = event.queryStringParameters?.q
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }

  if (!query) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing q parameter' }) }
  }

  try {
    const searchQuery = `site:linkedin.com/in ${query}`
    const candidates = []

    const braveUrl = `https://search.brave.com/search?q=${encodeURIComponent(searchQuery)}&source=web`
    const response = await fetch(braveUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'es-MX,es;q=0.9',
      },
    })
    const html = await response.text()

    // Strip all HTML tags first to get clean text for context extraction
    const cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

    // Extract LinkedIn profile URLs
    const urlPattern = /https?:\/\/[a-z]{2,3}\.linkedin\.com\/in\/[a-z0-9\-_%]+/gi
    const urls = new Set()
    let match
    while ((match = urlPattern.exec(html)) !== null) {
      const url = match[0].split('?')[0].split('#')[0].replace(/\/$/, '')
      if (!url.includes('login') && !url.includes('signup') && !url.includes('404') && !url.includes('jobs')) {
        urls.add(url)
      }
    }

    for (const profileUrl of urls) {
      const slug = profileUrl.split('/in/')[1]
      if (!slug || slug.length < 3) continue

      // Convert slug to name
      let decodedSlug
      try { decodedSlug = decodeURIComponent(slug) } catch(e) { decodedSlug = slug }

      const nameParts = decodedSlug
        .split('-')
        .filter(p => p.length > 0 && !/^\d+$/.test(p) && !/^[a-f0-9]{6,}$/i.test(p))
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())

      if (nameParts.length < 2) continue
      const fullName = nameParts.slice(0, 4).join(' ')

      // Skip if already found
      if (candidates.some(c => c.linkedin_url === profileUrl)) continue

      // Try to find the result title which usually has "Name - Title - Company | LinkedIn"
      // Look for the clean text pattern near the URL
      const urlIdx = cleanHtml.indexOf(profileUrl)
      let currentTitle = null
      let currentCompany = null

      if (urlIdx > -1) {
        // Get text around the URL, clean it
        const surrounding = cleanHtml
          .substring(Math.max(0, urlIdx - 300), Math.min(cleanHtml.length, urlIdx + 300))
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        // Look for "Name - Title - Company | LinkedIn" pattern
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
          // First segment is name, second is title, third is company
          if (segments.length >= 2) currentTitle = segments[1] || null
          if (segments.length >= 3) currentCompany = segments[2] || null
        }
      }

      // Clean any remaining HTML artifacts from title/company
      if (currentTitle && (currentTitle.includes('<') || currentTitle.includes('svelte') || currentTitle.includes('class'))) currentTitle = null
      if (currentCompany && (currentCompany.includes('<') || currentCompany.includes('svelte') || currentCompany.includes('class'))) currentCompany = null

      candidates.push({
        full_name: fullName,
        current_title: currentTitle,
        current_company: currentCompany,
        linkedin_url: profileUrl,
        snippet: null,
        location: null,
      })
    }

    // Fallback: try Google if Brave returned nothing
    if (candidates.length === 0) {
      try {
        const gUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=100&hl=es`
        const gRes = await fetch(gUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', 'Accept': 'text/html' } })
        const gHtml = await gRes.text()
        const gPattern = /linkedin\.com\/in\/([a-z0-9\-_%]{3,})/gi
        const seen = new Set()
        while ((match = gPattern.exec(gHtml)) !== null && candidates.length < 100) {
          const s = match[1].replace(/\/$/, '')
          if (seen.has(s) || s.includes('login')) continue
          seen.add(s)
          let decoded; try { decoded = decodeURIComponent(s) } catch(e) { decoded = s }
          const parts = decoded.split('-').filter(p => p.length > 0 && !/^\d+$/.test(p) && !/^[a-f0-9]{6,}$/i.test(p))
            .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
          if (parts.length < 2) continue
          candidates.push({ full_name: parts.slice(0, 4).join(' '), current_title: null, current_company: null, linkedin_url: `https://www.linkedin.com/in/${s}`, snippet: null, location: null })
        }
      } catch(e) {}
    }

    return { statusCode: 200, headers, body: JSON.stringify({ results: candidates.slice(0, 100), count: candidates.length, query: searchQuery }) }
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message, results: [] }) }
  }
}
