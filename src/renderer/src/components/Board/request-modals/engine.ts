import type { RequestData } from '@shared/engine/protocol'

export type DataOf<K extends RequestData['kind']> = Extract<RequestData, { kind: K }>

export { submitAnswer } from '../../../utils/duelSelection'
