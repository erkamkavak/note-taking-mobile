import { getEnv, makeFilename, normalizeUrl, wrapText } from './common'

export async function summarizedToPdf(url: string): Promise<{ pdfBase64: string; filename: string }> {
  const target = normalizeUrl(url)

  // 1) Fetch readable text via Jina Reader
  const jinaUrl = `https://r.jina.ai/${encodeURI(target)}`
  const res = await fetch(jinaUrl, {
    headers: {
      'User-Agent': 'note-taking-app',
      'Accept': 'text/plain',
    },
  })
  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`Failed to fetch content: ${res.status} ${res.statusText}${errorText ? ` - ${errorText.slice(0, 100)}` : ''}`)
  }
  const sourceText = await res.text()
  if (!sourceText || sourceText.trim().length === 0) {
    throw new Error('No content received from the webpage')
  }

  // 2) Summarize via OpenRouter
  const apiKey = getEnv('OPENROUTER_API_KEY')
  if (!apiKey) {
    throw new Error('Summarized mode requires OPENROUTER_API_KEY to be set on the server.')
  }
  const summary = await summarizeWithOpenRouter(apiKey, sourceText.slice(0, 20000), target)

  // 3) Turn into PDF
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const title = `Summary of ${target}`
  const lines = wrapText(summary, 95)

  let page = pdfDoc.addPage([595.28, 841.89]) // A4
  const { height } = page.getSize()
  const margin = 50
  let cursorY = height - margin

  page.drawText(title, {
    x: margin,
    y: cursorY - 18,
    size: 18,
    font,
    color: rgb(0, 0, 0),
    maxWidth: 595.28 - 2 * margin,
  })
  cursorY -= 26

  const lineHeight = 14
  for (const line of lines) {
    if (cursorY < margin + lineHeight + 20) {
      page = pdfDoc.addPage([595.28, 841.89])
      cursorY = page.getSize().height - margin
    }
    page.drawText(line, {
      x: margin,
      y: cursorY - lineHeight,
      size: 11,
      font,
      color: rgb(0, 0, 0),
      maxWidth: 595.28 - 2 * margin,
      lineHeight: lineHeight + 2,
    })
    cursorY -= lineHeight
  }

  const pdfBase64 = await pdfDoc.saveAsBase64({ dataUri: false })
  const filename = makeFilename(target)
  return { pdfBase64, filename }
}

async function summarizeWithOpenRouter(apiKey: string, text: string, url: string): Promise<string> {
  const endpoint = 'https://openrouter.ai/api/v1/chat/completions'
  const body = {
    model: 'openrouter/auto',
    messages: [
      { role: 'system', content: 'You are a concise assistant that summarizes web articles into clear, scannable notes for later annotation.' },
      {
        role: 'user',
        content: `Summarize the following content from ${url} into:\n- A short title\n- 5-10 bullet points of the main ideas\n- Key quotes (optional)\n- Suggested sections as headers\nKeep it concise and readable. Content:\n\n${text}`,
      },
    ],
    temperature: 0.3,
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://note-taking.local',
      'X-Title': 'Note Taking App',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`OpenRouter error: ${res.status} ${res.statusText}${t ? ` - ${t.slice(0, 200)}` : ''}`)
  }
  const data: any = await res.json()
  const content: string = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('No summary returned from OpenRouter')
  return content.trim()
}
