export type ToolType = 'pen' | 'highlighter' | 'eraser' | 'selector'

export type Settings = {
  tool: ToolType
  pen: { color: string; size: number }
  highlighter: { color: string; size: number; opacity: number }
  eraser: { size: number }
}

const SETTINGS_STORAGE_KEY = 'note-taking-app-settings'

const DEFAULTS: Settings = {
  tool: 'pen',
  pen: { color: '#1C1C1E', size: 4 },
  highlighter: { color: '#FFF6A1', size: 18, opacity: 0.32 },
  eraser: { size: 26 },
}

export const loadSettings = (): Settings => {
  if (typeof window === 'undefined') {
    return DEFAULTS
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULTS

    const parsed = JSON.parse(raw) as Partial<Settings>

    // Merge with defaults to handle new settings that might not exist in older saves
    const settings: Settings = {
      tool: parsed.tool ?? DEFAULTS.tool,
      pen: {
        color: parsed.pen?.color ?? DEFAULTS.pen.color,
        size: parsed.pen?.size ?? DEFAULTS.pen.size,
      },
      highlighter: {
        color: parsed.highlighter?.color ?? DEFAULTS.highlighter.color,
        size: parsed.highlighter?.size ?? DEFAULTS.highlighter.size,
        opacity: parsed.highlighter?.opacity ?? DEFAULTS.highlighter.opacity,
      },
      eraser: {
        size: parsed.eraser?.size ?? DEFAULTS.eraser.size,
      },
    }

    return settings
  } catch (error) {
    console.error('Failed to load settings', error)
    return DEFAULTS
  }
}

export const persistSettings = (settings: Settings): void => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('Failed to save settings', error)
  }
}
