import type { AgentModelConfig } from '@shared/index'
import {
  isLocalEndpoint,
  normalizeCardStrings,
  resolveActiveRuntime,
  type CustomCard,
  type CustomCardScriptGenerateResult,
  type CustomScriptTestPlan
} from '@shared/index'
import { acquireSession, type SessionConfig } from './agent/piSessionFactory'
import { configService } from './configService'
import { cdbService } from '../db/cdbService'
import { runCustomCardScriptTest } from './customCardScriptTest'
import {
  collectCustomCardScriptReferences,
  type CustomCardScriptReference
} from './customCardScriptReferences'

const MAX_REPAIR_ROUNDS = 3

const SYSTEM_PROMPT = `你是 YGOPro Lua 卡片脚本生成器，为自定义卡生成可直接被 ocgcore 执行的完整脚本。

只输出一个 JSON 对象，不要输出 Markdown 代码块或额外解释。JSON 结构：
{
  "script": "完整的 c<卡密>.lua 内容",
  "strings": ["与 aux.Stringid(id, n) 对应的文本，最多 16 条，缺失用空字符串"],
  "category": 0,
  "testPlan": {
    "version": 1,
    "seed": 42,
    "setup": [...],
    "checks": [...]
  },
  "notes": "可选说明"
}

脚本规则：
- 第一行写 -- c<卡密>.lua <卡名>，第二行写 local s,id,o=GetID()
- 在 s.initial_effect(c) 中注册所有效果
- 只实现效果文本明确描述的行为，不臆造 API
- 魔法/陷阱的效果发动用对应 EFFECT_TYPE_ACTIVATE 结构；怪兽效果按时点注册
- SetCost/SetTarget 的 chk==0 只检查可行性，不修改状态
- 文本明确“以……为对象”时用 Duel.SelectTarget；处理后选择用 operation 里的 Duel.SelectMatchingCard
- 需要提示/描述时使用 aux.Stringid(id,n)，并在 strings 的同一 n 写入文本
- 不使用 EDOPro 专有 API

category 是效果分类位掩码，根据效果选择；可用分类会在用户消息里给出。
testPlan 使用给定 schema；至少包含 load-script、assert-no-redtext、start-duel、advance，能断言 LP/区域数量时补上。
如果效果需要玩家做选择，在 testPlan.responses 里按顺序提供 select-card / yes-no / chain / option / position 响应；响应项会用完即移除，未提供的交互自动回退到默认选择。`

interface ParsedDraft {
  script: string
  strings: string[]
  category: number
  testPlan?: CustomScriptTestPlan
  notes?: string
}

function parseJsonObject(text: string): ParsedDraft {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON 对象。')
  const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
  const script = typeof raw.script === 'string' ? raw.script.trim() : ''
  if (!script) throw new Error('模型返回的脚本为空。')
  return {
    script,
    strings: normalizeCardStrings(raw.strings),
    category: Number.isFinite(Number(raw.category)) ? Number(raw.category) : 0,
    testPlan:
      raw.testPlan && typeof raw.testPlan === 'object'
        ? (raw.testPlan as CustomScriptTestPlan)
        : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined
  }
}

function buildUserPrompt(
  card: CustomCard,
  existingScript: string | undefined,
  references: CustomCardScriptReference[]
): string {
  const categories = cdbService
    .getSearchFilterOptions()
    .effectCategories.map((item) => `- ${item.mask}: ${item.label}`)
    .join('\n')
  const referenceText =
    references.length > 0
      ? references
          .map((item) => `--- ${item.name} (${item.code}) ---\n${item.script.trim()}`)
          .join('\n\n')
      : '（没有找到可用的相似卡脚本）'
  return `【卡片数据】
${JSON.stringify(
  {
    id: card.id,
    name: card.name,
    desc: card.desc,
    type: card.type,
    attribute: card.attribute,
    race: card.race,
    level: card.level,
    lscale: card.lscale,
    rscale: card.rscale,
    atk: card.atk,
    def: card.def,
    linkMarkers: card.linkMarkers,
    alias: card.alias,
    ot: card.ot,
    setcode: card.setcode,
    category: card.category,
    strings: card.strings
  },
  null,
  2
)}

【可用效果分类】
${categories || '（当前数据库没有分类文本，category 填 0）'}

【相似卡脚本参考】
${referenceText}

【现有脚本】
${existingScript?.trim() || '（无）'}

请生成脚本、strings、category 和测试计划。`
}

export async function generateCustomCardScript(
  card: CustomCard,
  existingScript?: string
): Promise<CustomCardScriptGenerateResult> {
  const appConfig = configService.get()
  const merged = {
    ...(appConfig.agentConfig ?? { baseUrl: '', apiKey: '', model: '' })
  } as AgentModelConfig
  const runtime = resolveActiveRuntime(merged)
  if (!runtime.apiKey && !isLocalEndpoint(runtime.baseUrl)) {
    return { success: false, error: '请先在设置中配置 AI 模型 API Key。' }
  }

  const cfg: SessionConfig = {
    providers: merged.providers,
    provider: runtime.providerId,
    baseUrl: runtime.baseUrl || 'https://api.deepseek.com/v1',
    apiKey: runtime.apiKey,
    model: runtime.model || 'deepseek-chat',
    apiFormat: runtime.apiFormat,
    systemPrompt: SYSTEM_PROMPT,
    reasoningEfforts: runtime.reasoningEfforts,
    reasoningEffort: runtime.reasoningEffort,
    contextWindow: runtime.contextWindow,
    maxTokens: runtime.maxTokens,
    input: runtime.input,
    supportsStructuredOutput: runtime.supportsStructuredOutput,
    supportsMidConversationSystem: runtime.supportsMidConversationSystem
  }

  let streamText = ''
  const session = await acquireSession(
    cfg,
    [],
    {
      emitEvent: () => undefined,
      onTextDelta: (delta) => {
        streamText += delta
      },
      onThinkingDelta: () => undefined
    },
    { cache: false, systemPrompt: SYSTEM_PROMPT }
  )

  try {
    const references = collectCustomCardScriptReferences(card)
    let prompt = buildUserPrompt(card, existingScript, references)
    let lastDraft: ParsedDraft | null = null
    let lastReport: CustomCardScriptGenerateResult['report']

    for (let round = 0; round < MAX_REPAIR_ROUNDS; round++) {
      streamText = ''
      await session.prompt(prompt)
      const draft = parseJsonObject(streamText)
      lastDraft = draft
      const report = await runCustomCardScriptTest({
        card,
        script: draft.script,
        plan: draft.testPlan
      })
      lastReport = report
      if (report.ok) {
        return {
          success: true,
          script: draft.script,
          strings: draft.strings,
          category: draft.category,
          testPlan: draft.testPlan,
          report,
          notes: draft.notes
        }
      }
      prompt = `上一版脚本测试失败：
${report.errors.join('\n')}

请修复并重新输出完整的 JSON，不要只输出补丁。原卡片数据：
${buildUserPrompt(card, existingScript, references)}`
    }

    return {
      success: false,
      script: lastDraft?.script,
      strings: lastDraft?.strings,
      category: lastDraft?.category,
      testPlan: lastDraft?.testPlan,
      report: lastReport,
      error: lastReport?.errors[0] ?? '脚本测试未通过。'
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : '脚本生成失败'
    }
  } finally {
    try {
      session.dispose()
    } catch {}
  }
}
