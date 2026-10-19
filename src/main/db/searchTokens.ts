export interface SearchToken {
  text: string
  mode: 'any' | 'name' | 'set'
  excluded: boolean
}

export function parseSearchTokens(input: string): SearchToken[] {
  const tokens: SearchToken[] = []
  let index = 0

  while (index < input.length) {
    while (/\s/.test(input[index] ?? '')) index++
    if (index >= input.length) break

    let excluded = false
    if (input[index] === '-') {
      excluded = true
      index++
    }

    let mode: SearchToken['mode'] = 'any'
    if (input[index] === '$') {
      mode = 'name'
      index++
    } else if (input[index] === '@') {
      mode = 'set'
      index++
    }

    let text = ''
    if (input[index] === '"') {
      index++
      const end = input.indexOf('"', index)
      if (end === -1) {
        text = input.slice(index)
        index = input.length
      } else {
        text = input.slice(index, end)
        index = end + 1
      }
    } else {
      const start = index
      while (index < input.length && !/\s/.test(input[index])) index++
      text = input.slice(start, index)
    }

    if (text.trim()) tokens.push({ text: text.trim(), mode, excluded })
  }

  return tokens
}
