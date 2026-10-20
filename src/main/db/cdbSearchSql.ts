import {
  CardSearchParams,
  CardType,
  NumericCompareOp,
  AVAIL_HIDDEN,
  searchPoolOption
} from '@shared/index'
import { COMPARATOR } from './cardSort'
import { CdbConnection } from './cdbConnections'
import { parseSearchTokens } from './searchTokens'

export function textSource(conn: CdbConnection): {
  pick: (column: string) => string
  join: string
} {
  const overlays = conn.overlayAliases
  return {
    pick: (column) =>
      overlays.length > 0
        ? `COALESCE(${[...overlays.map((alias) => `${alias}.${column}`), `t.${column}`].join(', ')})`
        : `t.${column}`,
    join: overlays
      .map((alias) => ` LEFT JOIN ${alias}.texts ${alias} ON ${alias}.id = d.id`)
      .join('')
  }
}

function getSetcodesForKeyword(setnameMap: Map<number, string>, keyword: string): number[] {
  const normalized = keyword.toLocaleLowerCase()
  const codes: number[] = []
  for (const [code, rawName] of setnameMap) {
    const names = rawName.split('|').map((name) => name.trim())
    const matched = names.some((name) => {
      const candidate = name.toLocaleLowerCase()
      return normalized.length < 2 ? candidate === normalized : candidate.includes(normalized)
    })
    if (matched) codes.push(code)
  }
  return codes
}

export interface SearchSqlPlan {
  countSql: string
  dataSql: string
  args: (string | number)[]
  dataArgs: (string | number)[]
  fetchLimit: number
}

export function buildSearchSql(
  conn: CdbConnection,
  params: CardSearchParams,
  fetchLimit: number,
  setnameMap: Map<number, string>,
  limitMap: Map<number, 1 | 2 | 3>,
  favorites?: number[]
): SearchSqlPlan {
  const { pick, join: overlayJoin } = textSource(conn)
  const nameExpr = pick('name')
  const descExpr = pick('desc')

  let baseWhere =
    ` FROM datas d JOIN texts t ON d.id = t.id${overlayJoin} WHERE 1=1` +
    ' AND (d.type & 16384) = 0' +
    ` AND (d.ot & ${AVAIL_HIDDEN}) = 0` +
    ` AND ${nameExpr} NOT LIKE '%占位符%'` +
    ' AND NOT (' +
    ' (d.type & 7) = 0 AND d.atk = 0 AND d.def = 0 AND (d.level & 255) = 0' +
    ` AND (${descExpr} IS NULL OR trim(${descExpr}) = ''` +
    ` OR ${descExpr} LIKE '%战斗包%' OR ${descExpr} LIKE '%Battle Pack%'` +
    ` OR ${descExpr} LIKE '%列表%' OR ${descExpr} LIKE '%常见%' OR ${descExpr} LIKE '%Common%')` +
    ' )'
  if (conn.coveredReady) {
    baseWhere += ' AND d.id NOT IN (SELECT id FROM __covered)'
  }
  const args: (string | number)[] = []
  // 排序对齐 ygopro DeckBuilder::SortList：仅卡名与搜索词完全相等时置顶，
  // 其余结果（含仅描述/系列匹配）同档，只按用户所选排序规则排
  const exactKeyword = (params.keyword ?? '').trim()
  const relevanceArgs: (string | number)[] = []

  const getSetcodeClause = (codes: number[]): string => {
    const exactCodes = [...new Set(codes)]
    const baseCodes = [...new Set(codes.map((code) => code & 0xfff))]
    const parts: string[] = []
    for (const shift of [0, 16, 32, 48]) {
      const exactMarks = exactCodes.map(() => '?').join(',')
      const baseMarks = baseCodes.map(() => '?').join(',')
      parts.push(
        `(((d.setcode >> ${shift}) & 65535) IN (${exactMarks}) OR ((d.setcode >> ${shift}) & 4095) IN (${baseMarks}))`
      )
      args.push(...exactCodes, ...baseCodes)
    }
    return `(${parts.join(' OR ')})`
  }

  if (params.keyword && params.keyword.trim().length > 0) {
    const keyword = params.keyword.trim()
    if (/^\d+$/.test(keyword)) {
      baseWhere += ` AND (d.id = ? OR ${nameExpr} LIKE ?)`
      args.push(parseInt(keyword, 10), `%${keyword}%`)
    } else {
      for (const token of parseSearchTokens(keyword)) {
        const clauses: string[] = []
        const like = `%${token.text}%`
        if (token.mode !== 'set') {
          clauses.push(`${nameExpr} LIKE ?`)
          args.push(like)
        }
        if (token.mode === 'any' && params.searchDesc !== false) {
          clauses.push(`${descExpr} LIKE ?`)
          args.push(like)
        }
        if (token.mode !== 'name') {
          const setcodes = getSetcodesForKeyword(setnameMap, token.text)
          if (setcodes.length > 0) clauses.push(getSetcodeClause(setcodes))
          else if (token.mode === 'set') clauses.push('0=1')
        }
        if (clauses.length === 0) continue
        const match = `(${clauses.join(' OR ')})`
        baseWhere += token.excluded ? ` AND NOT ${match}` : ` AND ${match}`
      }
    }
  }

  if (params.type !== undefined && params.type !== 0) {
    baseWhere += ' AND (d.type & ?) != 0'
    args.push(params.type)
  }

  if (params.subType !== undefined && params.subType !== 0) {
    if (params.type === CardType.SPELL || params.type === CardType.TRAP) {
      baseWhere += ' AND d.type = ?'
      args.push(params.subType)
    } else {
      baseWhere += ' AND (d.type & ?) = ?'
      args.push(params.subType, params.subType)
    }
  }

  if (params.attribute !== undefined && params.attribute !== 0) {
    baseWhere += ' AND (d.attribute & ?) != 0'
    args.push(params.attribute)
  }
  if (params.race !== undefined && params.race !== 0) {
    baseWhere += ' AND (d.race & ?) != 0'
    args.push(params.race)
  }

  const addNumericFilter = (
    column: string,
    value: number | undefined,
    op: NumericCompareOp | undefined,
    allowUnknown = false
  ): void => {
    const compare = op ?? 'eq'
    if (compare === 'unknown') {
      if (allowUnknown) baseWhere += ` AND ${column} = -2`
      return
    }
    if (value === undefined || value < 0) return
    if (compare === 'lt' || compare === 'lte') baseWhere += ` AND ${column} >= 0`
    baseWhere += ` AND ${column} ${COMPARATOR[compare]} ?`
    args.push(value)
  }

  if (params.level !== undefined && params.level > 0) {
    addNumericFilter('(d.level & 255)', params.level, params.levelOp)
  }

  if (params.scale !== undefined) {
    baseWhere += ' AND (d.type & ?) != 0'
    args.push(CardType.PENDULUM)
    addNumericFilter('((d.level >> 24) & 255)', params.scale, params.scaleOp)
  }

  addNumericFilter('d.atk', params.atk, params.atkOp, true)
  if (params.def !== undefined || params.defOp === 'unknown') {
    baseWhere += ' AND (d.type & ?) = 0'
    args.push(CardType.LINK)
  }
  addNumericFilter('d.def', params.def, params.defOp, true)

  if (params.effectCategoryMask !== undefined && params.effectCategoryMask > 0) {
    baseWhere += ' AND (d.category & ?) != 0'
    args.push(params.effectCategoryMask)
  }

  const pool = searchPoolOption(params.cardPool)
  if (pool) {
    baseWhere += pool.exact ? ' AND d.ot = ?' : ' AND (d.ot & ?) != 0'
    args.push(pool.mask)
  }

  if (params.limitFilter) {
    const codes: number[] = []
    for (const [code, level] of limitMap) {
      if (level === params.limitFilter) codes.push(code)
    }
    if (codes.length === 0) {
      baseWhere += ' AND 0=1'
    } else {
      baseWhere += ` AND d.id IN (${codes.map(() => '?').join(',')})`
      args.push(...codes)
    }
  }

  if (params.markers !== undefined && params.markers !== 0) {
    baseWhere += ' AND (d.type & ?) != 0 AND (d.def & ?) = ?'
    args.push(CardType.LINK, params.markers, params.markers)
  }

  if (params.onlyFavorites) {
    if (!favorites || favorites.length === 0) {
      baseWhere += ' AND 0=1'
    } else {
      baseWhere += ` AND d.id IN (${favorites.map(() => '?').join(',')})`
      args.push(...favorites)
    }
  }

  const orderDir = params.sortOrder === 'ASC' ? 'ASC' : 'DESC'
  const groupDir = orderDir === 'ASC' ? 'DESC' : 'ASC'
  const relCase = exactKeyword.length > 0 ? `CASE WHEN ${nameExpr} = ? THEN 0 ELSE 1 END` : '0'
  if (exactKeyword.length > 0) relevanceArgs.push(exactKeyword)
  const subtypeSql =
    `CASE WHEN (d.type & 7) = 1 THEN` +
    ` CASE WHEN (d.type & 0x48020c0) != 0 THEN (d.type & 0x48020c1) ELSE (d.type & 0x31) END` +
    ` ELSE (d.type & 4294967288) END`
  const keyOrder = (keys: string[]): string =>
    keys
      .map((key) => `${key} ${key === 'subKey' || key === 'typeKey' ? groupDir : orderDir}`)
      .join(', ') + `, d.id ${groupDir}`
  let orderBy: string
  if (params.sortField === 'atk') {
    orderBy = keyOrder(['typeKey', 'atkKey', 'defKey', 'levelKey', 'subKey'])
  } else if (params.sortField === 'def') {
    orderBy = keyOrder(['typeKey', 'defKey', 'atkKey', 'levelKey', 'subKey'])
  } else if (params.sortField === 'name') {
    orderBy = `${nameExpr} COLLATE BINARY ${orderDir}, d.id ASC`
  } else {
    orderBy = keyOrder(['typeKey', 'subKey', 'levelKey', 'atkKey', 'defKey'])
  }

  const countSql = `SELECT count(*) as total` + baseWhere
  const dataSql = `
    SELECT
      d.id, d.ot, d.alias, d.setcode, d.type, d.atk, d.def, d.level, d.race, d.attribute, d.category,
      ${nameExpr} AS name, ${descExpr} AS desc,
      (d.type & 7) AS typeKey,
      ${subtypeSql} AS subKey,
      CASE WHEN (d.type & 7) = 1 THEN COALESCE(d.level & 255, -3) ELSE 0 END AS levelKey,
      CASE WHEN (d.type & 7) = 1 THEN COALESCE(d.atk, -3) ELSE 0 END AS atkKey,
      CASE WHEN (d.type & 7) = 1 THEN COALESCE(d.def, -3) ELSE 0 END AS defKey,
      ${relCase} AS relKey
    ${baseWhere}
    ORDER BY relKey ASC, ${orderBy}
    LIMIT ?
  `

  return { countSql, dataSql, args, dataArgs: [...relevanceArgs, ...args], fetchLimit }
}
