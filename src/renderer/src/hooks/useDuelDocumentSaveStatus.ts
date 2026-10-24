import { useSyncExternalStore } from 'react'
import {
  getDuelDocumentSaveStatus,
  subscribeDuelDocumentSaveStatus,
  type DuelDocumentSaveState
} from '../utils/duelDocumentAutosave'

export function useDuelDocumentSaveStatus(): DuelDocumentSaveState {
  return useSyncExternalStore(
    subscribeDuelDocumentSaveStatus,
    getDuelDocumentSaveStatus,
    getDuelDocumentSaveStatus
  )
}
