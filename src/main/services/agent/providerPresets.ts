import type { AgentProviderPreset } from '@shared/index'

const PROVIDER_PRESETS: AgentProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://platform.deepseek.com/api_keys',
    category: 'cn'
  },
  {
    id: 'dashscope',
    name: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://bailian.console.aliyun.com/?apiKey=1',
    category: 'cn'
  },
  {
    id: 'moonshot',
    name: 'Kimi (月之暗面)',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://platform.moonshot.cn/console/api-keys',
    category: 'cn'
  },
  {
    id: 'bigmodel',
    name: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    category: 'cn'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/v1',
    apiFormat: 'openai-chat-completions',
    category: 'cn'
  },
  {
    id: 'xiaomi-mimo',
    name: '小米 MiMo',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    apiFormat: 'openai-chat-completions',
    category: 'cn'
  },

  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiFormat: 'openai-responses',
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    category: 'global'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    apiFormat: 'anthropic-messages',
    apiKeyUrl: 'https://console.anthropic.com/settings/keys',
    category: 'global'
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    apiFormat: 'openai-responses',
    apiKeyUrl: 'https://console.x.ai',
    category: 'global'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiFormat: 'openai-chat-completions',
    apiKeyUrl: 'https://openrouter.ai/keys',
    category: 'global'
  },

  {
    id: 'ollama',
    name: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    apiFormat: 'openai-chat-completions',
    category: 'local'
  }
]

export function getProviderPresets(): AgentProviderPreset[] {
  return PROVIDER_PRESETS
}
