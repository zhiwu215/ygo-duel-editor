import { ipcMain } from 'electron'
import { agentService } from '../services/agentService'

export function registerAgentIpc(): void {
  ipcMain.handle('agent:send-message', async (_, params) => {
    return agentService.sendMessage(params)
  })

  ipcMain.handle('agent:handoff', async (_, request) => {
    return agentService.handoff(request)
  })

  ipcMain.handle('agent:abort', async () => {
    return agentService.abort()
  })

  ipcMain.handle('agent:reset-session', async () => {
    return agentService.resetSession()
  })

  ipcMain.handle('agent:fetch-models', async (_, params) => {
    return agentService.fetchModels(String(params?.baseUrl ?? ''), String(params?.apiKey ?? ''))
  })

  ipcMain.handle('agent:get-provider-presets', async () => {
    return agentService.getProviderPresets()
  })
}
