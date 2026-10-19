import { INFINITY_VALUE, isInfiniteVal } from '@shared/index'

export interface LpParseResult {
  valid: boolean
  result: number
  formula: string
  mode: 'direct' | 'relative' | 'expression' | 'invalid'
}

export type LpOperator = '-' | '+' | '/' | '*' | '=' | 'inf'

export function safeEvalMath(expr: string): number | null {
  if (!/^[\d\s+\-*/.]+$/.test(expr)) return null

  const tokens = expr.match(/\d+(?:\.\d+)?|[+\-*/]/g)
  if (!tokens || tokens.length === 0) return null

  if (/[*/]/.test(tokens[0]) || /[+\-*/]/.test(tokens[tokens.length - 1])) return null

  const numbers: number[] = []
  const ops: string[] = []
  let i = 0

  if (tokens[0] === '-' || tokens[0] === '+') {
    const sign = tokens[0] === '-' ? -1 : 1
    i = 1
    if (i >= tokens.length || isNaN(Number(tokens[i]))) return null
    numbers.push(sign * Number(tokens[i]))
    i++
  } else {
    if (isNaN(Number(tokens[0]))) return null
    numbers.push(Number(tokens[0]))
    i = 1
  }

  while (i < tokens.length) {
    const op = tokens[i]
    if (!['+', '-', '*', '/'].includes(op)) return null
    i++
    if (i >= tokens.length) return null
    const num = Number(tokens[i])
    if (isNaN(num)) return null
    i++

    if (op === '*') {
      const prev = numbers.pop()!
      numbers.push(prev * num)
    } else if (op === '/') {
      if (num === 0) return null
      const prev = numbers.pop()!
      numbers.push(prev / num)
    } else {
      ops.push(op)
      numbers.push(num)
    }
  }

  let total = numbers[0]
  for (let j = 0; j < ops.length; j++) {
    if (ops[j] === '+') {
      total += numbers[j + 1]
    } else if (ops[j] === '-') {
      total -= numbers[j + 1]
    }
  }

  return total
}

export function parseLpExpression(rawInput: string, currentLp: number): LpParseResult {
  let input = rawInput.trim().replace(/÷/g, '/').replace(/[×xX]/g, '*')

  if (input.startsWith('=')) {
    input = input.slice(1).trim()
  }

  if (!input) {
    return { valid: false, result: currentLp, formula: '请输入数值或算式', mode: 'invalid' }
  }

  const isDirectInfinity =
    input === '∞' ||
    input.toLowerCase() === 'inf' ||
    input.toLowerCase() === 'infinity' ||
    input === '无限'

  if (isDirectInfinity) {
    return {
      valid: true,
      result: INFINITY_VALUE,
      formula: '设为 无限',
      mode: 'direct'
    }
  }

  if (/^[+\-*/]/.test(input)) {
    const op = input[0]
    const rest = input.slice(1).trim()
    const opSymbol = op === '/' ? '÷' : op === '*' ? '×' : op

    if (!rest) {
      const opName = op === '-' ? '扣除' : op === '+' ? '增加' : op === '/' ? '除以' : '乘'
      const baseDesc = isInfiniteVal(currentLp) ? '无限' : String(currentLp)
      return {
        valid: false,
        result: currentLp,
        formula: `${baseDesc} ${opSymbol} ... (${opName})`,
        mode: 'relative'
      }
    }

    const isRestInfinity =
      rest === '∞' ||
      rest.toLowerCase() === 'inf' ||
      rest.toLowerCase() === 'infinity' ||
      rest === '无限'

    if (isRestInfinity) {
      if (op === '-') {
        return {
          valid: true,
          result: 0,
          formula: '扣除至 0',
          mode: 'relative'
        }
      }
      return {
        valid: true,
        result: INFINITY_VALUE,
        formula: '增加至 无限',
        mode: 'relative'
      }
    }

    if (isInfiniteVal(currentLp)) {
      return {
        valid: true,
        result: INFINITY_VALUE,
        formula: `无限 ${opSymbol} ${rest} (仍为无限)`,
        mode: 'relative'
      }
    }

    const fullExpr = `${currentLp} ${input}`
    const evaluated = safeEvalMath(fullExpr)
    if (evaluated !== null && !isNaN(evaluated)) {
      const finalVal = Math.max(0, Math.floor(evaluated))
      return {
        valid: true,
        result: finalVal >= INFINITY_VALUE ? INFINITY_VALUE : finalVal,
        formula: `${currentLp} ${opSymbol} ${rest}`,
        mode: 'relative'
      }
    }
    return { valid: false, result: currentLp, formula: '算式格式有误', mode: 'invalid' }
  }

  if (/^\d+$/.test(input)) {
    const val = parseInt(input, 10)
    if (val >= INFINITY_VALUE) {
      return {
        valid: true,
        result: INFINITY_VALUE,
        formula: '设为 无限',
        mode: 'direct'
      }
    }
    return {
      valid: true,
      result: Math.max(0, val),
      formula: `直接设为 ${val}`,
      mode: 'direct'
    }
  }

  const evaluated = safeEvalMath(input)
  if (evaluated !== null && !isNaN(evaluated)) {
    const finalVal = Math.max(0, Math.floor(evaluated))
    const isInf = finalVal >= INFINITY_VALUE
    const displayExpr = input.replace(/\//g, '÷').replace(/\*/g, '×')
    return {
      valid: true,
      result: isInf ? INFINITY_VALUE : finalVal,
      formula: isInf ? `${displayExpr} → 无限` : displayExpr,
      mode: 'expression'
    }
  }

  return { valid: false, result: currentLp, formula: '输入无效', mode: 'invalid' }
}

export function detectCurrentOp(rawInput: string): LpOperator {
  const trimmed = rawInput.trim().toLowerCase()
  if (trimmed === '∞' || trimmed === 'inf' || trimmed === 'infinity' || trimmed === '无限') {
    return 'inf'
  }
  if (trimmed.startsWith('-')) return '-'
  if (trimmed.startsWith('+')) return '+'
  if (trimmed.startsWith('/') || trimmed.startsWith('÷')) return '/'
  if (trimmed.startsWith('*') || trimmed.startsWith('×')) return '*'
  return '='
}

export function switchOperator(currentText: string, newOp: LpOperator, currentLp: number): string {
  if (newOp === 'inf') {
    return '无限'
  }

  const trimmed = currentText.trim()
  const isCurrentInf = trimmed === '∞' || trimmed === '无限' || isInfiniteVal(currentLp)

  if (isCurrentInf || trimmed === String(currentLp) || !trimmed) {
    return newOp === '=' ? '' : newOp
  }

  const numMatch = trimmed.match(/[\d.]+$/)
  const numPart = numMatch ? numMatch[0] : ''

  if (newOp === '=') {
    return numPart
  }
  return `${newOp}${numPart}`
}
