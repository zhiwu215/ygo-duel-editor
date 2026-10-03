/** 生命值计算器解析结果 */
export interface LpParseResult {
  valid: boolean
  result: number
  /** 用户输入的算式或说明展示，例如 "8000 - 1100" */
  formula: string
  /** 计算模式 */
  mode: 'direct' | 'relative' | 'expression' | 'invalid'
}

/** 支持的运算符类型 */
export type LpOperator = '-' | '+' | '/' | '*' | '='

/**
 * 安全的简易四则运算求值器 (支持 +, -, *, /，支持先乘除后加减)
 * 纯算法分词与堆栈运算，杜绝 eval/Function 安全隐患
 */
export function safeEvalMath(expr: string): number | null {
  // 严格只允许数字、小数点、空格与加减乘除符号
  if (!/^[\d\s+\-*/.]+$/.test(expr)) return null

  // 分词
  const tokens = expr.match(/\d+(?:\.\d+)?|[+\-*/]/g)
  if (!tokens || tokens.length === 0) return null

  // 首尾非法符号检查（不能以 * / 开头，不能以任何运算符结尾）
  if (/[*/]/.test(tokens[0]) || /[+\-*/]/.test(tokens[tokens.length - 1])) return null

  const numbers: number[] = []
  const ops: string[] = []
  let i = 0

  // 1. 处理首个可能带有的负号或正号
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

  // 2. 乘除高优先级运算
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
      if (num === 0) return null // 除零保护
      const prev = numbers.pop()!
      numbers.push(prev / num)
    } else {
      ops.push(op)
      numbers.push(num)
    }
  }

  // 3. 加减运算
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

/**
 * 解析用户在生命值框输入的字符串 (支持直接数值、增减算式与四则运算)
 */
export function parseLpExpression(rawInput: string, currentLp: number): LpParseResult {
  // 规范化输入：将全角或常见符号统一为标准运算符
  const input = rawInput.trim().replace(/÷/g, '/').replace(/[×xX]/g, '*')

  if (!input) {
    return { valid: false, result: currentLp, formula: '请输入数值或算式', mode: 'invalid' }
  }

  // 1. 相对算式：以 +、-、*、/ 开头（如 -1100、+500、/2）
  if (/^[+\-*/]/.test(input)) {
    const op = input[0]
    const rest = input.slice(1).trim()
    if (!rest) {
      const opName = op === '-' ? '扣除' : op === '+' ? '增加' : op === '/' ? '除以' : '乘'
      return {
        valid: false,
        result: currentLp,
        formula: `${currentLp} ${op} ... (${opName})`,
        mode: 'relative'
      }
    }
    const fullExpr = `${currentLp} ${input}`
    const evaluated = safeEvalMath(fullExpr)
    if (evaluated !== null && !isNaN(evaluated)) {
      const finalLp = Math.max(0, Math.floor(evaluated))
      const opSymbol = op === '/' ? '÷' : op === '*' ? '×' : op
      return {
        valid: true,
        result: finalLp,
        formula: `${currentLp} ${opSymbol} ${rest}`,
        mode: 'relative'
      }
    }
    return { valid: false, result: currentLp, formula: '算式格式有误', mode: 'invalid' }
  }

  // 2. 绝对纯数字（如 4000）
  if (/^\d+$/.test(input)) {
    const val = parseInt(input, 10)
    return {
      valid: true,
      result: Math.max(0, val),
      formula: `直接设为 ${val}`,
      mode: 'direct'
    }
  }

  // 3. 完整四则算式（如 8000-1100, 4000+500, 8000/2）
  const evaluated = safeEvalMath(input)
  if (evaluated !== null && !isNaN(evaluated)) {
    const finalLp = Math.max(0, Math.floor(evaluated))
    const displayExpr = input.replace(/\//g, '÷').replace(/\*/g, '×')
    return {
      valid: true,
      result: finalLp,
      formula: displayExpr,
      mode: 'expression'
    }
  }

  return { valid: false, result: currentLp, formula: '输入无效', mode: 'invalid' }
}

/**
 * 识别输入字符串当前的运算模式
 */
export function detectCurrentOp(rawInput: string): LpOperator {
  const trimmed = rawInput.trim()
  if (trimmed.startsWith('-')) return '-'
  if (trimmed.startsWith('+')) return '+'
  if (trimmed.startsWith('/') || trimmed.startsWith('÷')) return '/'
  if (trimmed.startsWith('*') || trimmed.startsWith('×')) return '*'
  return '='
}

/**
 * 切换四则运算符时，平滑保留或重置输入框中的数字
 */
export function switchOperator(currentText: string, newOp: LpOperator, currentLp: number): string {
  const trimmed = currentText.trim()
  // 如果当前是初始完整数值或空，直接切换为对应运算符，方便用户直接键入数字
  if (trimmed === String(currentLp) || !trimmed) {
    return newOp === '=' ? '' : newOp
  }

  // 提取用户已输入的纯数字部分 (如 "-1100" 中的 "1100")
  const numMatch = trimmed.match(/[\d.]+$/)
  const numPart = numMatch ? numMatch[0] : ''

  if (newOp === '=') {
    return numPart
  }
  return `${newOp}${numPart}`
}
