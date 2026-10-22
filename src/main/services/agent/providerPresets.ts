import type { AgentProviderPreset } from '@shared/index'

const PROVIDER_PRESETS: AgentProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'deepseek-flash',
        name: 'DeepSeek-V4.1-Flash',
        input: ['text', 'image'],
        contextWindow: 131072,
        maxTokens: 65536,
        reasoningEfforts: {
          off: null,
          low: 'low',
          medium: 'medium',
          high: 'high',
          max: 'max'
        }
      },
      {
        id: 'deepseek-v4-pro',
        name: 'DeepSeek-V4-Pro',
        input: ['text'],
        contextWindow: 262144,
        maxTokens: 65536,
        reasoningEfforts: {
          off: null,
          low: 'low',
          medium: 'medium',
          high: 'high',
          max: 'max'
        }
      }
    ]
  },
  {
    id: 'amazon-bedrock',
    name: 'Amazon Bedrock',
    baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com',
    apiFormat: 'bedrock-converse-stream',
    note: '需要 AWS Bedrock 凭据。',
    models: [
      {
        id: 'us.anthropic.claude-opus-4-6-v1',
        name: 'Claude Opus 4.6 (US)',
        input: ['text', 'image'],
        contextWindow: 1000000,
        maxTokens: 128000,
        reasoningEfforts: {
          max: 'max',
          off: null
        },
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'ant-ling',
    name: 'Ant Ling',
    baseUrl: 'https://api.ant-ling.com/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'Ring-2.6-1T',
        name: 'Ring 2.6 1T',
        input: ['text'],
        contextWindow: 262144,
        maxTokens: 65536,
        reasoningEfforts: {
          off: null,
          high: 'high',
          xhigh: 'xhigh'
        },
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    apiFormat: 'anthropic-messages',
    models: [
      {
        id: 'claude-opus-4-8',
        name: 'Claude Opus 4.8',
        input: ['text', 'image'],
        contextWindow: 1000000,
        maxTokens: 128000,
        reasoningEfforts: {
          xhigh: 'xhigh',
          max: 'max',
          off: null
        },
        supportsMidConversationSystem: true
      }
    ]
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    baseUrl: '',
    apiFormat: 'azure-openai-responses',
    note: '需填写 Azure 资源端点。',
    models: [
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
        input: ['text', 'image'],
        contextWindow: 1050000,
        maxTokens: 128000,
        reasoningEfforts: {
          off: null,
          xhigh: 'xhigh'
        }
      }
    ]
  },
  {
    id: 'baseten',
    name: 'Baseten',
    baseUrl: 'https://inference.baseten.co/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'zai-org/GLM-5.2',
        name: 'GLM 5.2',
        input: ['text'],
        contextWindow: 1048576,
        maxTokens: 262144,
        reasoningEfforts: {
          off: 'none',
          high: 'high',
          max: 'max'
        },
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'gpt-oss-120b',
        name: 'GPT OSS 120B',
        input: ['text'],
        contextWindow: 131072,
        maxTokens: 40960,
        reasoningEfforts: {
          off: null,
          low: 'low',
          medium: 'medium',
          high: 'high'
        }
      }
    ]
  },
  {
    id: 'cloudflare-ai-gateway',
    name: 'Cloudflare AI Gateway',
    baseUrl:
      'https://gateway.ai.cloudflare.com/v1/{CLOUDFLARE_ACCOUNT_ID}/{CLOUDFLARE_GATEWAY_ID}/compat',
    apiFormat: 'openai-chat-completions',
    note: '请把 API 地址中的账户 ID 与网关 ID 替换为实际值。',
    models: [
      {
        id: 'workers-ai/@cf/moonshotai/kimi-k2.6',
        name: 'Kimi K2.6',
        input: ['text', 'image'],
        contextWindow: 262144,
        maxTokens: 256000
      }
    ]
  },
  {
    id: 'cloudflare-workers-ai',
    name: 'Cloudflare Workers AI',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1',
    apiFormat: 'openai-chat-completions',
    note: '请把 API 地址中的账户 ID 替换为实际值。',
    models: [
      {
        id: '@cf/moonshotai/kimi-k2.6',
        name: 'Kimi K2.6',
        input: ['text', 'image'],
        contextWindow: 262144,
        maxTokens: 256000,
        reasoningEfforts: {
          off: 'none',
          high: 'high'
        },
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'fireworks',
    name: 'Fireworks',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'accounts/fireworks/models/kimi-k3',
        name: 'Kimi K3',
        input: ['text', 'image'],
        contextWindow: 1048576,
        maxTokens: 131072,
        reasoningEfforts: {
          off: null,
          low: 'low',
          high: 'high',
          max: 'max'
        },
        supportsStructuredOutput: true,
        supportsMidConversationSystem: true
      }
    ]
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    baseUrl: 'https://api.individual.githubcopilot.com',
    apiFormat: 'openai-responses',
    note: '使用 GitHub Copilot 原生登录凭据。',
    models: [
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
        input: ['text', 'image'],
        contextWindow: 1000000,
        maxTokens: 128000,
        reasoningEfforts: {
          off: null,
          minimal: 'low',
          low: 'low',
          medium: 'medium',
          high: 'high',
          xhigh: 'xhigh'
        },
        supportsMidConversationSystem: true
      }
    ]
  },
  {
    id: 'google',
    name: 'Google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiFormat: 'google-generative-ai',
    models: [
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro Preview',
        input: ['text', 'image'],
        contextWindow: 1048576,
        maxTokens: 65536,
        reasoningEfforts: {
          off: null,
          low: 'low',
          medium: 'medium',
          high: 'high'
        }
      }
    ]
  },
  {
    id: 'google-vertex',
    name: 'Google Vertex AI',
    baseUrl: 'https://{location}-aiplatform.googleapis.com',
    apiFormat: 'google-vertex',
    note: '请填写带区域的端点，并配置 Google Cloud 凭据。',
    models: [
      {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro Preview',
        input: ['text', 'image'],
        contextWindow: 1048576,
        maxTokens: 65536,
        reasoningEfforts: {
          off: null,
          low: 'low',
          medium: 'medium',
          high: 'high'
        }
      }
    ]
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'openai/gpt-oss-120b',
        name: 'GPT OSS 120B',
        input: ['text'],
        contextWindow: 131072,
        maxTokens: 65536,
        reasoningEfforts: {
          off: null,
          low: 'low',
          medium: 'medium',
          high: 'high'
        },
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    baseUrl: 'https://router.huggingface.co/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'moonshotai/Kimi-K2.6',
        name: 'Kimi-K2.6',
        input: ['text', 'image'],
        contextWindow: 262144,
        maxTokens: 262144,
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'kimi-coding',
    name: 'Kimi For Coding',
    baseUrl: 'https://api.kimi.com/coding',
    apiFormat: 'anthropic-messages',
    models: [
      {
        id: 'kimi-for-coding',
        input: ['text', 'image'],
        contextWindow: 1048576,
        maxTokens: 32768,
        reasoningEfforts: {
          off: null,
          low: 'low',
          high: 'high',
          max: 'max'
        }
      }
    ]
  },
  {
    id: 'meta',
    name: 'Meta',
    baseUrl: 'https://api.meta.ai/v1',
    apiFormat: 'openai-responses',
    models: [
      {
        id: 'muse-spark-1.3',
        name: 'Muse Spark 1.3',
        input: ['text', 'image'],
        contextWindow: 1048576,
        maxTokens: 131072,
        reasoningEfforts: {
          off: null,
          minimal: 'minimal',
          low: 'low',
          medium: 'medium',
          high: 'high',
          xhigh: 'xhigh',
          max: 'max'
        }
      }
    ]
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.io/anthropic',
    apiFormat: 'anthropic-messages',
    models: [
      {
        id: 'MiniMax-M2.7',
        input: ['text'],
        contextWindow: 204800,
        maxTokens: 131072
      }
    ]
  },
  {
    id: 'minimax-cn',
    name: 'MiniMax CN',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    apiFormat: 'anthropic-messages',
    models: [
      {
        id: 'MiniMax-M2.7',
        input: ['text'],
        contextWindow: 204800,
        maxTokens: 131072
      }
    ]
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai',
    apiFormat: 'mistral-conversations',
    models: [
      {
        id: 'devstral-medium-latest',
        name: 'Devstral 2 (latest)',
        input: ['text'],
        contextWindow: 262144,
        maxTokens: 262144
      }
    ]
  },
  {
    id: 'moonshotai',
    name: 'Moonshot AI',
    baseUrl: 'https://api.moonshot.ai/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'kimi-k2.6',
        name: 'Kimi K2.6',
        input: ['text', 'image'],
        contextWindow: 262144,
        maxTokens: 262144,
        supportsMidConversationSystem: true
      }
    ]
  },
  {
    id: 'moonshotai-cn',
    name: 'Moonshot AI CN',
    baseUrl: 'https://api.moonshot.cn/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'kimi-k2.6',
        name: 'Kimi K2.6',
        input: ['text', 'image'],
        contextWindow: 262144,
        maxTokens: 262144,
        supportsMidConversationSystem: true
      }
    ]
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'nvidia/nemotron-3-super-120b-a12b',
        name: 'Nemotron 3 Super',
        input: ['text'],
        contextWindow: 262144,
        maxTokens: 262144
      }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiFormat: 'openai-responses',
    models: [
      {
        id: 'gpt-5.5',
        name: 'GPT-5.5',
        input: ['text', 'image'],
        contextWindow: 272000,
        maxTokens: 128000,
        reasoningEfforts: {
          off: 'none',
          low: 'low',
          medium: 'medium',
          high: 'high',
          xhigh: 'xhigh'
        },
        supportsStructuredOutput: true,
        supportsMidConversationSystem: true
      }
    ]
  },
  {
    id: 'openai-codex',
    name: 'OpenAI Codex (legacy)',
    baseUrl: 'https://chatgpt.com/backend-api',
    apiFormat: 'openai-codex-responses',
    note: '使用 ChatGPT 登录凭据。',
    models: [
      {
        id: 'gpt-6.1-sol',
        name: 'GPT-6.1 Sol',
        input: ['text', 'image'],
        contextWindow: 272000,
        maxTokens: 128000,
        reasoningEfforts: {
          off: null,
          minimal: 'low',
          low: 'low',
          medium: 'medium',
          high: 'high',
          xhigh: 'xhigh',
          max: 'max'
        },
        supportsMidConversationSystem: true
      }
    ]
  },
  {
    id: 'opencode',
    name: 'OpenCode Zen',
    baseUrl: 'https://opencode.ai/zen/v1',
    apiFormat: 'openai-chat-completions',
    note: '使用 OpenCode 凭据。',
    models: [
      {
        id: 'kimi-k2.6',
        name: 'Kimi K2.6',
        input: ['text', 'image'],
        contextWindow: 262144,
        maxTokens: 65536,
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    baseUrl: 'https://opencode.ai/zen/go/v1',
    apiFormat: 'openai-chat-completions',
    note: '使用 OpenCode 凭据。',
    models: [
      {
        id: 'kimi-k3',
        name: 'Kimi K3',
        input: ['text', 'image'],
        contextWindow: 1048576,
        maxTokens: 131072,
        reasoningEfforts: {
          off: null,
          max: 'max'
        },
        supportsStructuredOutput: true,
        supportsMidConversationSystem: true
      }
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'moonshotai/kimi-k2.6',
        name: 'MoonshotAI: Kimi K2.6',
        input: ['text', 'image'],
        contextWindow: 262144,
        maxTokens: 235929,
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'qwen-token-plan',
    name: 'Qwen Token Plan',
    baseUrl: 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'qwen3.7-max',
        name: 'Qwen3.7 Max',
        input: ['text'],
        contextWindow: 1000000,
        maxTokens: 131072,
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'qwen-token-plan-cn',
    name: 'Qwen Token Plan CN',
    baseUrl: 'https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'qwen3.7-max',
        name: 'Qwen3.7 Max',
        input: ['text'],
        contextWindow: 1000000,
        maxTokens: 131072,
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'qwen-token-plan-individual',
    name: 'Qwen Token Plan Individual',
    baseUrl: 'https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'qwen3.8-max',
        name: 'Qwen3.8 Max',
        input: ['text', 'image'],
        contextWindow: 1000000,
        maxTokens: 131072,
        reasoningEfforts: {
          off: null,
          low: 'low',
          medium: 'medium',
          xhigh: 'xhigh'
        },
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'radius',
    name: 'Radius',
    baseUrl: 'https://radius.pi.dev/v1',
    apiFormat: 'pi-messages',
    models: [
      {
        id: 'balanced',
        name: 'Balanced',
        input: ['text', 'image'],
        contextWindow: 1048576,
        maxTokens: 131072,
        reasoningEfforts: {
          off: null,
          low: 'low',
          high: 'high',
          max: 'max'
        }
      }
    ]
  },
  {
    id: 'together',
    name: 'Together',
    baseUrl: 'https://api.together.ai/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'moonshotai/Kimi-K3',
        name: 'Kimi K3',
        input: ['text', 'image'],
        contextWindow: 1048576,
        maxTokens: 131072
      }
    ]
  },
  {
    id: 'vercel-ai-gateway',
    name: 'Vercel AI Gateway',
    baseUrl: 'https://ai-gateway.vercel.sh',
    apiFormat: 'anthropic-messages',
    models: [
      {
        id: 'zai/glm-5.1',
        name: 'GLM 5.1',
        input: ['text'],
        contextWindow: 202800,
        maxTokens: 64000
      }
    ]
  },
  {
    id: 'xai',
    name: 'xAI',
    baseUrl: 'https://api.x.ai/v1',
    apiFormat: 'openai-responses',
    models: [
      {
        id: 'grok-4.7',
        name: 'Grok 4.7',
        input: ['text', 'image'],
        contextWindow: 500000,
        maxTokens: 500000,
        reasoningEfforts: {
          off: null,
          low: 'low',
          medium: 'medium',
          high: 'high',
          xhigh: 'xhigh'
        }
      }
    ]
  },
  {
    id: 'xiaomi',
    name: 'Xiaomi',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'mimo-v2.5-pro',
        name: 'MiMo-V2.5-Pro',
        input: ['text'],
        contextWindow: 1048576,
        maxTokens: 131072,
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'xiaomi-token-plan-ams',
    name: 'Xiaomi Token Plan AMS',
    baseUrl: 'https://token-plan-ams.xiaomimimo.com/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'mimo-v2.5-pro',
        name: 'MiMo-V2.5-Pro',
        input: ['text'],
        contextWindow: 1048576,
        maxTokens: 131072,
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'xiaomi-token-plan-cn',
    name: 'Xiaomi Token Plan CN',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'mimo-v2.5-pro',
        name: 'MiMo-V2.5-Pro',
        input: ['text'],
        contextWindow: 1048576,
        maxTokens: 131072,
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'xiaomi-token-plan-sgp',
    name: 'Xiaomi Token Plan SGP',
    baseUrl: 'https://token-plan-sgp.xiaomimimo.com/v1',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'mimo-v2.5-pro',
        name: 'MiMo-V2.5-Pro',
        input: ['text'],
        contextWindow: 1048576,
        maxTokens: 131072,
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'zai',
    name: 'Z.AI',
    baseUrl: 'https://api.z.ai/api/coding/paas/v4',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'glm-5.3',
        name: 'GLM-5.3',
        input: ['text'],
        contextWindow: 1000000,
        maxTokens: 131072,
        reasoningEfforts: {
          off: null,
          low: 'low',
          high: 'high',
          max: 'max'
        },
        supportsStructuredOutput: true
      }
    ]
  },
  {
    id: 'zai-coding-cn',
    name: 'Z.AI Coding CN',
    baseUrl: 'https://open.bigmodel.cn/api/coding/paas/v4',
    apiFormat: 'openai-chat-completions',
    models: [
      {
        id: 'glm-5.3',
        name: 'GLM-5.3',
        input: ['text'],
        contextWindow: 1000000,
        maxTokens: 131072,
        reasoningEfforts: {
          off: null,
          low: 'low',
          high: 'high',
          max: 'max'
        },
        supportsStructuredOutput: true
      }
    ]
  }
]

export function getProviderPresets(): AgentProviderPreset[] {
  return PROVIDER_PRESETS
}
