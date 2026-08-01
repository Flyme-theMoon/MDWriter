import { app } from 'electron'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AppState } from '../../shared/types/state'

function statePath(): string {
  return join(app.getPath('userData'), 'ui-state.json')
}

export async function loadAppState(): Promise<AppState | null> {
  try {
    const raw = await readFile(statePath(), 'utf8')
    const parsed = JSON.parse(raw) as AppState
    if (!parsed || !Array.isArray(parsed.tabs)) return null
    return parsed
  } catch {
    return null
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  const target = statePath()
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.tmp`
  await writeFile(temporary, JSON.stringify(state), 'utf8')
  await rename(temporary, target)
}
