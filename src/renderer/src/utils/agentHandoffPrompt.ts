const REQUIREMENTS = `要求：
- 先判断原文里哪几段适合改写成决斗，再只编排这些段落；
- 把角色与冲突改写为决斗双方的动作与台词，按回合与阶段拆分为可执行步骤；
- 保留原文关键设定与人物性格，不要照抄原文叙述句式；
- 同时给出开局盘面（双方 LP、场上卡片与表示形式、手牌），以便直接摆到决斗场上。`

export function buildChapterHandoffPrompt(input: {
  title: string
  label: string
  chapterCount: number
  total: number
}): string {
  return `请根据《${input.title}》的「${input.label}」编排一场决斗剧情（共 ${input.chapterCount} 章、约 ${input.total.toLocaleString()} 字）。

${REQUIREMENTS}

已附加这 ${input.chapterCount} 章原文，请先用 read_text_source 通读后再动笔。`
}

export function buildExtractHandoffPrompt(input: { title: string; materials: string }): string {
  return `以下是我从《${input.title}》中挑选的章节原文，请据此编排一场《游戏王》决斗剧情。
${REQUIREMENTS}

以下是所选章节原文：

${input.materials}`
}
