import puppeteer from '@cloudflare/puppeteer'
import { env } from 'cloudflare:workers'
import { arrayBufferToBase64, makeFilename, normalizeUrl } from './common'

export async function staticCapture(url: string): Promise<{ pdfBase64: string; filename: string }> {
  const target = normalizeUrl(url)
  console.log('staticCapture: Starting for URL:', target)
  console.log('staticCapture: Launching browser with env:', env)

  const browser = await puppeteer.launch(env.NOTE_TAKING_PUPPETEER)
  try {
    console.log('staticCapture: Browser launched, creating page...')
    const page = await browser.newPage()
    console.log('staticCapture: Page created, navigating to:', target)
    await page.goto(target, { waitUntil: 'networkidle2' })
    console.log('staticCapture: Page loaded, emulating media...')
    await page.emulateMediaType('screen')
    console.log('staticCapture: Generating PDF...')
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    })
    console.log('staticCapture: PDF generated, size:', pdf.length)
    const base64 = arrayBufferToBase64(pdf as unknown as ArrayBuffer)
    console.log('staticCapture: PDF converted to base64, length:', base64.length)
    const filename = makeFilename(target)
    console.log('staticCapture: Completed successfully, filename:', filename)
    return { pdfBase64: base64, filename }
  } catch (e) {
    console.error('staticCapture: Error:', e)
    throw e
  } finally {
    await browser.close()
  }
}
