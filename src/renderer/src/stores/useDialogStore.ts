import { create } from 'zustand'

type DialogKind = 'confirm' | 'alert'

interface DialogRequest {
  id: number
  kind: DialogKind
  title: string
  description?: string
  confirmText?: string
  destructive?: boolean
  resolve: (value: boolean) => void
}

interface DialogState {
  requests: DialogRequest[]
  push: (request: DialogRequest) => void
  settle: (id: number, value: boolean) => void
}

export const useDialogStore = create<DialogState>((set, get) => ({
  requests: [],
  push: (request) => set((state) => ({ requests: [...state.requests, request] })),
  settle: (id, value) => {
    const request = get().requests.find((item) => item.id === id)
    request?.resolve(value)
    set((state) => ({ requests: state.requests.filter((item) => item.id !== id) }))
  }
}))

let nextDialogId = 1

interface ConfirmDialogOptions {
  title: string
  description?: string
  confirmText?: string
  destructive?: boolean
}

export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({
      id: nextDialogId++,
      kind: 'confirm',
      ...options,
      resolve
    })
  })
}

export function alertDialog(message: string): Promise<boolean> {
  const [first, ...rest] = message.split('\n')
  const hasBody = rest.length > 0
  const title = hasBody ? first.replace(/[：:]\s*$/, '') : first
  const description = hasBody ? rest.join('\n').replace(/^\n+/, '') : undefined
  return new Promise((resolve) => {
    useDialogStore.getState().push({
      id: nextDialogId++,
      kind: 'alert',
      title,
      description,
      resolve
    })
  })
}
