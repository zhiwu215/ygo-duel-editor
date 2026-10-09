import { CdbCard } from '@shared/index'

const CHUNK_SIZE = 400

/**
 * 按卡密批量取卡片详情，跨 cdb 库合并；单批失败降级为空结果，不影响其它批次。
 *
 * 分片原因：主进程那条SQL 是 `WHERE d.id IN (?,?,...)`，SQLite 绑定变量有上限
 * （老版本999），一次几百个卡密会直接抛错。
 */
export async function fetchCardDataByCodes(codes: number[]): Promise<Record<number, CdbCard>> {
  const uniqueCodes = Array.from(new Set(codes.filter((code) => code > 0)))
  if (uniqueCodes.length === 0) return {}

  const chunks: number[][] = []
  for (let i = 0; i < uniqueCodes.length; i += CHUNK_SIZE) {
    chunks.push(uniqueCodes.slice(i, i + CHUNK_SIZE))
  }

  const maps = await Promise.all(
    chunks.map((chunk) =>
      window.api
        .getCardsByIds(chunk)
        .then((map) => map)
        .catch((err) => {
          console.error('[cardData] getCardsByIds failed:', err)
          return {} as Record<number, CdbCard>
        })
    )
  )

  const merged: Record<number, CdbCard> = {}
  for (const map of maps) {
    for (const key of Object.keys(map)) {
      const code = Number(key)
      if (code > 0 && !merged[code]) merged[code] = map[code]
    }
  }
  return merged
}
