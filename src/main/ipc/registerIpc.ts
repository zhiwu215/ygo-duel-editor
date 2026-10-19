import { registerDuelEngineIpc } from './duelEngineIpc'
import { registerCdbIpc } from './cdbIpc'
import { registerCustomCardIpc } from './customCardIpc'
import { registerProjectIpc } from './projectIpc'
import { registerLibraryIpc } from './libraryIpc'
import { registerNoteIpc } from './noteIpc'
import { registerDeckIpc } from './deckIpc'
import { registerAgentIpc } from './agentIpc'
import { registerConfigIpc } from './configIpc'
import { registerDataDirIpc } from './dataDirIpc'
import { registerWindowIpc } from './windowIpc'

export function registerAllIpcHandlers(): void {
  registerDuelEngineIpc()
  registerCdbIpc()
  registerCustomCardIpc()
  registerProjectIpc()
  registerLibraryIpc()
  registerNoteIpc()
  registerDeckIpc()
  registerAgentIpc()
  registerConfigIpc()
  registerDataDirIpc()
  registerWindowIpc()
}
