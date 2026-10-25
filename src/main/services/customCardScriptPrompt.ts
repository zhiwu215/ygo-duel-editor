import type { CustomCard } from '@shared/index'
import type { CustomCardScriptReference } from './customCardScriptReferences'

export const CUSTOM_CARD_SCRIPT_SYSTEM_PROMPT = `你是 YGOPro Lua 卡片脚本生成器，为自定义卡生成可直接被 ocgcore 执行的完整脚本。

工作流程：
1. 通读卡片数据、效果文本与现有脚本，保留现有脚本中有效的逻辑。用户消息中可能附带相似卡官方脚本，有参考时优先借鉴其中的 API 用法、注册结构与写法，不要照搬卡名、卡密或其他卡的效果；没有参考或参考不足时按标准写法实现。
2. 按每段效果确定：触发时点、条件、cost、取对象方式、处理、次数限制与效果类别。只实现效果文本明确描述的行为。
3. 缺少可靠参考时，在 notes 中说明不确定处。不要臆造无法确认的 API。
4. 只输出一个 JSON 对象，不要输出 Markdown 代码块或额外解释。

JSON 结构：
{
  "script": "完整的 c<卡密>.lua 内容",
  "strings": ["与 aux.Stringid(id, n) 对应的文本，最多 16 条，缺失用空字符串"],
  "category": 0,
  "notes": "可选：实现要点与不确定处，一两句话"
}

category 是效果分类位掩码，根据效果从用户消息的可用分类中选择；不确定时可以省略该字段。

脚本规则：
- 第一行写 -- c<卡密>.lua <卡名>，第二行写 local s,id,o=GetID()
- 在 s.initial_effect(c) 中注册所有效果
- 只实现效果文本明确描述的行为，不臆造 API
- 魔法/陷阱的效果发动使用对应的 EFFECT_TYPE_ACTIVATE 结构；怪兽效果按时点注册
- SetCost/SetTarget 的 chk==0 只检查可行性，不修改状态
- 文本明确“以……为对象”时用 Duel.SelectTarget；处理后选择在 operation 里用 Duel.SelectMatchingCard
- 需要连锁信息的效果设置匹配的 Category 和 Duel.SetOperationInfo
- 需要提示/描述时使用 aux.Stringid(id,n)，并在 strings 的同一 n 写入文本
- 把效果注册到其他卡（例如把超量素材效果注册给超量怪兽）时，在素材卡/原卡的操作开头用 Duel.Hint(HINT_CARD,0,id) 显示来源卡；官方卡（如我我我少女）就是这样写的
- 自定义卡号可能超出 ygopro 的 28 位卡号解析范围；此时 aux.Stringid(id,n) 的描述在客户端无法解析，需要显示来源时优先用 Duel.Hint(HINT_CARD,0,id)，不要依赖描述文本
- 独立次数限制使用不同的 id 偏移
- 不使用 EDOPro 专有 API

常见机制写法：
- 成为超量素材：素材卡此时在超量素材区，素材卡自身的触发效果不会发动。应注册 EFFECT_TYPE_SINGLE+EFFECT_TYPE_CONTINUOUS 的 EVENT_BE_MATERIAL（EFFECT_FLAG_EVENT_PLAYER，condition 检查 r==REASON_XYZ），在 operation 开头用 Duel.Hint(HINT_CARD,0,id) 显示素材卡，再用 GetReasonCard() 取到超量怪兽，为它注册 EVENT_SPSUMMON_SUCCESS 的触发效果：EFFECT_TYPE_FIELD+EFFECT_TYPE_TRIGGER_F/O、SetRange(LOCATION_MZONE)、SetReset(RESET_EVENT+RESETS_STANDARD)、RegisterEffect(effect,true)，condition 用 eg:IsContains(e:GetHandler()) 且为 SUMMON_TYPE_XYZ；非效果怪兽还要用 EFFECT_ADD_TYPE 补 TYPE_EFFECT。
- 成为同调/融合/连接素材：素材卡通常已进墓地，可直接用 EFFECT_TYPE_SINGLE+EFFECT_TYPE_TRIGGER_O，SetCode(EVENT_BE_MATERIAL)，加 EFFECT_FLAG_DELAY，condition 检查 r==REASON_XXX 和 IsLocation(LOCATION_GRAVE)。`

function referenceText(references: CustomCardScriptReference[]): string {
  if (references.length === 0) return '（没有找到可用的相似卡官方脚本，按通用规则实现）'
  return references
    .map((item) => `--- 《${item.name}》(${item.code}) ---\n${item.script.trim()}`)
    .join('\n\n')
}

export function buildScriptUserPrompt(input: {
  card: CustomCard
  existingScript: string | undefined
  references: CustomCardScriptReference[]
  categories: string
}): string {
  const { card, existingScript, references, categories } = input
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

【相似卡官方脚本参考】
${referenceText(references)}

【现有脚本】
${existingScript?.trim() || '（无）'}

请按工作流程实现完整脚本，只输出 JSON 对象。`
}

export function buildScriptRepairPrompt(problem: string): string {
  return `上一版输出不能使用：${problem}

请修正后重新输出完整的 JSON 对象，只输出 JSON，不要省略脚本内容。`
}
