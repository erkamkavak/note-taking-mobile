export function normalizeUrl(input: string): string {
  try {
    const hasScheme = /^https?:\/\//i.test(input)
    return hasScheme ? input : `https://${input}`
  } catch {
    return input
  }
}

export function isValidHttpUrl(u: string): boolean {
  try {
    const url = new URL(u)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const host = url.hostname.toLowerCase()
    if (!host || host.startsWith('_')) return false
    if (host === 'localhost' || host.endsWith('.localhost')) return true
    // Require a dot in public hostnames to avoid internal pseudo-hosts like _serverfn
    if (!host.includes('.')) return false
    return true
  } catch {
    return false
  }
}

export function getEnv(name: string): string | undefined {
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process?.env) return process.env[name]
  } catch {}
  try {
    // @ts-ignore
    const maybe = (globalThis as any)?.process?.env?.[name]
    if (maybe) return maybe
  } catch {}
  return undefined
}

export async function safeText(r: Response) {
  try { return await r.text() } catch { return '' }
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  try {
    // @ts-ignore
    if (typeof Buffer !== 'undefined') return Buffer.from(buf).toString('base64')
  } catch {}
  let binary = ''
  const bytes = new Uint8Array(buf)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk)
    binary += String.fromCharCode.apply(null, Array.from(sub) as any)
  }
  // @ts-ignore
  return btoa(binary)
}

export function makeFilename(u: string) {
  try {
    const { hostname, pathname } = new URL(u)
    const base = `${hostname}${pathname}`.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '')
    return `${base || 'import'}.pdf`
  } catch {
    return 'import.pdf'
  }
}

export function wrapText(text: string, max: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if ((line + (line ? ' ' : '') + w).length > max) {
      lines.push(line)
      line = w
    } else {
      line = line ? line + ' ' + w : w
    }
  }
  if (line) lines.push(line)
  return lines
}
