import { AgentTextSourceRef, CardUtils, CdbCard } from '@shared/index'

function buildCardsBlock(cards: CdbCard[]): string {
  const blocks = cards.map((c) => {
    const typeLabel = CardUtils.getCardTypeLabel(c.type)
    const isSpellOrTrap = CardUtils.isSpell(c.type) || CardUtils.isTrap(c.type)
    const stats = isSpellOrTrap
      ? ''
      : ` 攻${c.atk} / 防${c.def}${CardUtils.isLink(c.type) ? '' : ` / ${CardUtils.getStarLevel(c.level)}星`}`
    return [`【${c.name}】(${typeLabel}${stats})`, `卡密: ${c.id}`, c.desc ? `效果: ${c.desc}` : '']
      .filter(Boolean)
      .join('\n')
  })
  return `【我参考的卡片】\n${blocks.join('\n\n')}`
}

export function buildInjectedPrompt(
  prompt: string,
  cards: CdbCard[],
  text: AgentTextSourceRef | null
): string {
  const blocks: string[] = []
  if (cards.length > 0) blocks.push(buildCardsBlock(cards))
  if (text) {
    const size = text.wordCount ? `约 ${text.wordCount} 字` : ''
    blocks.push(
      `【文本素材】已附加《${text.title}》${size ? `（${size}）` : ''}。正文不随消息直接发送，请先用 read_text_source 分段通读全文。`
    )
  }
  if (blocks.length === 0) return prompt
  return `${blocks.join('\n\n')}\n\n【我的问题】\n${prompt}`
}
