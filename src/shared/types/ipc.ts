import { CdbCard } from './card'
import { DuelPuzzleState } from './duel'

/**
 * 卡片检索查询参数
 */
export interface CardSearchParams {
  keyword?: string // 卡名 / 效果描述 / 8位卡密
  type?: number // 种类掩码
  race?: number // 种族掩码
  attribute?: number // 属性掩码
  level?: number // 星级 / Rank / Link
  atk?: number // 攻击力
  def?: number // 守备力
  limit?: number // 每次返回条数 (默认 50)
  offset?: number // 分页偏移量
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
  searchCards: (params: CardSearchParams) => Promise<CdbCard[]>
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
