import { DeckData } from './deck'

export function parseYdk(content: string, defaultName = '新建卡组'): DeckData {
  const lines = content.split(/\r?\n/)
  const deck: DeckData = {
    name: defaultName,
    description: '',
    tags: [],
    main: [],
    extra: [],
    side: []
  }

  let section: 'main' | 'extra' | 'side' | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('#name:')) {
      deck.name = line.replace('#name:', '').trim() || defaultName
      continue
    }

    if (line.startsWith('#desc:')) {
      deck.description = decodeURIComponent(line.replace('#desc:', '').trim())
      continue
    }

    if (line.startsWith('#cover:')) {
      const cover = parseInt(line.replace('#cover:', '').trim(), 10)
      if (!isNaN(cover) && cover > 0) deck.coverCard = cover
      continue
    }

    if (line.startsWith('#tags:')) {
      const rawTags = line.replace('#tags:', '').trim()
      deck.tags = rawTags
        ? rawTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : []
      continue
    }

    if (line.startsWith('#group:')) {
      const group = line.replace('#group:', '').trim()
      if (group) deck.group = group
      continue
    }

    if (line === '#main') {
      section = 'main'
      continue
    }
    if (line === '#extra') {
      section = 'extra'
      continue
    }
    if (line === '!side' || line === '#side') {
      section = 'side'
      continue
    }

    if (line.startsWith('#') || line.startsWith('!')) {
      continue
    }

    const code = parseInt(line, 10)
    if (!isNaN(code) && code > 0) {
      if (section === 'main') {
        deck.main.push(code)
      } else if (section === 'extra') {
        deck.extra.push(code)
      } else if (section === 'side') {
        deck.side.push(code)
      }
    }
  }

  return deck
}

export function generateYdk(deck: DeckData): string {
  const lines: string[] = [`#created by YGO Duel Editor`, `#name:${deck.name || '未命名卡组'}`]

  if (deck.description) {
    lines.push(`#desc:${encodeURIComponent(deck.description)}`)
  }
  if (deck.coverCard) {
    lines.push(`#cover:${deck.coverCard}`)
  }
  if (deck.tags && deck.tags.length > 0) {
    lines.push(`#tags:${deck.tags.join(',')}`)
  }
  if (deck.group) {
    lines.push(`#group:${deck.group}`)
  }

  lines.push(`#main`)
  for (const code of deck.main) {
    lines.push(String(code))
  }

  lines.push(`#extra`)
  for (const code of deck.extra) {
    lines.push(String(code))
  }

  lines.push(`!side`)
  for (const code of deck.side) {
    lines.push(String(code))
  }

  return lines.join('\n') + '\n'
}
