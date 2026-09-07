import { song } from './song.svelte'
import { tracker } from './tracker.svelte'
import { serializeSong } from '../tracker/model/validate'

let downloadHandler: ((data: string, filename: string) => void) | null = null

export function downloadProject(): void {
  const data = serializeSong(song.doc)
  const filename = `${(song.doc.meta.name || 'untitled').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80)}.pulsar.json`
  if (downloadHandler) {
    downloadHandler(data, filename)
    return
  }
  const url = URL.createObjectURL(
    new Blob([data], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
export function requestProjectAction(action: 'new' | 'open'): void {
  window.dispatchEvent(new CustomEvent('pulsar:project', { detail: action }))
}

/** Trusted same-origin host API. Pulled at menu-open time; no cached history
 * or cross-frame keyboard synthesis. Disposed with the app. */
export function installProjectHost(): () => void {
  const nativeField = (): boolean => {
    const field = document.activeElement
    return (
      field instanceof HTMLTextAreaElement ||
      (field instanceof HTMLInputElement && field.type === 'text')
    )
  }
  const host = {
    canUndo: () =>
      nativeField() ? document.queryCommandEnabled('undo') : song.canUndo,
    canRedo: () =>
      nativeField() ? document.queryCommandEnabled('redo') : song.canRedo,
    undo: () => {
      if (nativeField()) document.execCommand('undo')
      else song.undo()
    },
    redo: () => {
      if (nativeField()) document.execCommand('redo')
      else song.redo()
    },
    download: downloadProject,
    setDownloadHandler: (handler: typeof downloadHandler) => {
      downloadHandler = handler
    },
    newProject: () => requestProjectAction('new'),
    openProject: () => requestProjectAction('open'),
    stop: () => tracker.stop(),
  }
  const target = window as Window & { pulsarHost?: typeof host }
  target.pulsarHost = host
  return () => {
    downloadHandler = null
    delete target.pulsarHost
  }
}
