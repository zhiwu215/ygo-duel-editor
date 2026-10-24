import { create } from 'zustand'

type DialogKind = 'confirm' | 'alert' | 'prompt'
type DialogValue = boolean | string | null

export interface DialogExtraAction {
  text: string
  value: string
}

interface DialogRequest {
  id: number
  kind: DialogKind
  title: string
  description?: string
  placeholder?: string
  confirmText?: string
  destructive?: boolean
  icon?: 'warning' | 'info'
  extraAction?: DialogExtraAction
  initialValue?: string
  resolve: (value: DialogValue) => void
}

interface DialogState {
  requests: DialogRequest[]
  push: (request: DialogRequest) => void
  settle: (id: number, value: DialogValue) => void
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
  icon?: 'warning' | 'info'
  extraAction?: DialogExtraAction
}

export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean | string> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({
      id: nextDialogId++,
      kind: 'confirm',
      ...options,
      resolve: resolve as (value: DialogValue) => void
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
      resolve: resolve as (value: DialogValue) => void
    })
  })
}

interface PromptDialogOptions {
  title: string
  placeholder?: string
  confirmText?: string
  initialValue?: string
}

export function promptDialog(options: PromptDialogOptions): Promise<string | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().push({
      id: nextDialogId++,
      kind: 'prompt',
      ...options,
      resolve: resolve as (value: DialogValue) => void
    })
  })
}
