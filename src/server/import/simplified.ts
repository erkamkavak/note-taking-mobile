import { makeFilename, normalizeUrl, wrapText } from './common'

export async function simplifiedToPdf(url: string): Promise<{ pdfBase64: string; filename: string }> {
  const target = normalizeUrl(url)

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

  const text = await res.text()
  if (!text || text.trim().length === 0) {
    throw new Error('No content received from the webpage')
  }

  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const lines = wrapText(text.slice(0, 40000), 90)
  const title = `Imported from ${target}`

  let page = pdfDoc.addPage([595.28, 841.89])
  const { height } = page.getSize()
  const margin = 50
  let cursorY = height - margin

  const titleSize = 18
  page.drawText(title, {
    x: margin,
    y: cursorY - titleSize,
    size: titleSize,
    font,
    color: rgb(0, 0, 0),
    maxWidth: 595.28 - 2 * margin,
  })
  cursorY -= titleSize + 20

  const lineHeight = 14
  const paragraphSpacing = 8

  for (const line of lines) {
    if (cursorY < margin + lineHeight + 20) {
      page = pdfDoc.addPage([595.28, 841.89])
      cursorY = page.getSize().height - margin
    }

    if (line.trim() === '') {
      cursorY -= paragraphSpacing
      continue
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
