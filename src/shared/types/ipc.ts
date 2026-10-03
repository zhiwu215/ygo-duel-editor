import { CdbCard } from './card'
import { DuelPuzzleState } from './duel'

/**
 * 卡片检索查询参数
 */
export interface CardSearchParams {
  keyword?: string // 卡名 / 效果描述 / 8位卡密
  /**
   * 是否在效果描述中检索关键词 (默认 true)
   */
  searchDesc?: boolean
  /**
   * 主种类掩码 (Monster / Spell / Trap)
   */
  type?: number // 主种类掩码 (Monster / Spell / Trap)
  /**
   * 细分种类掩码 (Fusion / Synchro / Quickplay 等)
   */
  subType?: number // 细分种类掩码 (Fusion / Synchro / Quickplay 等)
  /**
   * 种族掩码
   */
  race?: number // 种族掩码
  attribute?: number // 属性掩码
  level?: number // 星级 / Rank / Link
  atk?: number // 攻击力
  def?: number // 守备力
  /**
   * 8位卡密精准匹配
   */
  code?: number // 8位卡密精准匹配
  sortField?: 'id' | 'atk' | 'def' | 'level' | 'name' // 排序字段
  sortOrder?: 'ASC' | 'DESC' // 排序方向
  limit?: number // 每次返回条数 (默认 50)
  offset?: number // 分页偏移量
}

/**
 * 卡片检索返回结果
 */
export interface CardSearchResult {
  cards: CdbCard[]
  total: number
}

/**
 * 用户配置
 */
export interface AppConfig {
  gameDirectory?: string // EDOPro / MDPro3 安装根目录
  cdbPath?: string // 当前使用的 cards.cdb 完整路径
  theme: 'dark' | 'light'
}

/**
 * IPC 通道名称与接口契约
 */
export interface IpcApi {
  // CDB 数据库操作
  selectCdbFile: () => Promise<string | null>
  loadCdb: (path: string) => Promise<boolean>
  searchCards: (params: CardSearchParams) => Promise<CardSearchResult>
  getCardsByIds: (ids: number[]) => Promise<Record<number, CdbCard>>

  // 脚本导出与导入
  exportLuaFile: (
    state: DuelPuzzleState,
    targetPath?: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>
  importLuaFile: () => Promise<{ success: boolean; state?: DuelPuzzleState; error?: string }>

  // 工程保存与打开
  saveProjectFile: (state: DuelPuzzleState) => Promise<{ success: boolean; filePath?: string }>
  loadProjectFile: () => Promise<{ success: boolean; state?: DuelPuzzleState }>

  // 用户设置
  getConfig: () => Promise<AppConfig>
  saveConfig: (config: Partial<AppConfig>) => Promise<boolean>
  selectGameDirectory: () => Promise<string | null>

  // 本地卡图路径查询
  getCardImagePath: (code: number, small?: boolean) => Promise<string | null>
}
