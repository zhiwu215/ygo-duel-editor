/**
 * 游戏王 ocgcore 标准指示物代码与名称映射 (源自 strings.conf)
 */

export interface CounterDefinition {
  id: number
  hex: string
  name: string
}

export const COUNTER_DEFINITIONS: CounterDefinition[] = [
  { id: 1, hex: '0x1', name: '魔力指示物' },
  { id: 4098, hex: '0x1002', name: '楔指示物' },
  { id: 3, hex: '0x3', name: '武士道指示物' },
  { id: 4, hex: '0x4', name: '念力指示物' },
  { id: 5, hex: '0x5', name: '光指示物' },
  { id: 6, hex: '0x6', name: '宝玉指示物' },
  { id: 7, hex: '0x7', name: '指示物（剑斗兽之槛）' },
  { id: 8, hex: '0x8', name: '变形斗士指示物' },
  { id: 4105, hex: '0x1009', name: '毒指示物' },
  { id: 10, hex: '0xa', name: '次世代指示物' },
  { id: 11, hex: '0xb', name: '指示物（古代的机械城）' },
  { id: 12, hex: '0xc', name: '雷指示物' },
  { id: 13, hex: '0xd', name: '强欲指示物' },
  { id: 4110, hex: '0x100e', name: 'A指示物' },
  { id: 15, hex: '0xf', name: '虫指示物' },
  { id: 16, hex: '0x10', name: '黑羽指示物' },
  { id: 17, hex: '0x11', name: '超毒指示物' },
  { id: 18, hex: '0x12', name: '机巧指示物' },
  { id: 19, hex: '0x13', name: '混沌指示物' },
  { id: 20, hex: '0x14', name: '指示物（奇迹之侏罗纪蛋）' },
  { id: 4117, hex: '0x1015', name: '冰指示物' },
  { id: 22, hex: '0x16', name: '魔石指示物' },
  { id: 23, hex: '0x17', name: '橡子指示物' },
  { id: 24, hex: '0x18', name: '花指示物' },
  { id: 4121, hex: '0x1019', name: '雾指示物' },
  { id: 26, hex: '0x1a', name: '倍倍指示物' },
  { id: 27, hex: '0x1b', name: '时计指示物' },
  { id: 28, hex: '0x1c', name: 'D指示物' },
  { id: 29, hex: '0x1d', name: '废品指示物' },
  { id: 30, hex: '0x1e', name: '门指示物' },
  { id: 31, hex: '0x1f', name: '指示物（巨大战舰）' },
  { id: 32, hex: '0x20', name: '植物指示物' },
  { id: 4129, hex: '0x1021', name: '守卫指示物' },
  { id: 34, hex: '0x22', name: '龙神指示物' },
  { id: 35, hex: '0x23', name: '海洋指示物' },
  { id: 4132, hex: '0x1024', name: '线指示物' },
  { id: 37, hex: '0x25', name: '年代记指示物' },
  { id: 38, hex: '0x26', name: '指示物（金属射手）' },
  { id: 39, hex: '0x27', name: '指示物（死亡蚊）' },
  { id: 40, hex: '0x28', name: '指示物（暗黑弹射手）' },
  { id: 41, hex: '0x29', name: '指示物（气球蜥蜴）' },
  { id: 4138, hex: '0x102a', name: '指示物（魔法防护器）' },
  { id: 43, hex: '0x2b', name: '命运指示物' },
  { id: 44, hex: '0x2c', name: '遵命指示物' },
  { id: 45, hex: '0x2d', name: '指示物（踢火）' },
  { id: 46, hex: '0x2e', name: '鲨指示物' },
  { id: 47, hex: '0x2f', name: '南瓜指示物' },
  { id: 48, hex: '0x30', name: '毅飞冲天指示物' },
  { id: 49, hex: '0x31', name: '希望剑指示物' },
  { id: 50, hex: '0x32', name: '气球指示物' },
  { id: 51, hex: '0x33', name: '妖仙指示物' },
  { id: 52, hex: '0x34', name: '指示物（纸箱拳击手）' },
  { id: 53, hex: '0x35', name: '音响指示物' },
  { id: 54, hex: '0x36', name: '娱乐法师指示物' },
  { id: 55, hex: '0x37', name: '坏兽指示物' },
  { id: 4152, hex: '0x1038', name: '方界指示物' },
  { id: 4153, hex: '0x1039', name: '咕咚指示物' },
  { id: 64, hex: '0x40', name: '指示物（No.51 怪腕之必杀摔角手）' },
  { id: 4161, hex: '0x1041', name: '捕食指示物' },
  { id: 66, hex: '0x42', name: '指示物（爆竹鬼）' },
  { id: 67, hex: '0x43', name: '缺陷指示物' },
  { id: 68, hex: '0x44', name: '指示物（弹带城壁龙）' },
  { id: 4165, hex: '0x1045', name: '鳞粉指示物' },
  { id: 70, hex: '0x46', name: '指示物（刚鬼死斗）' },
  { id: 71, hex: '0x47', name: '指示物（限制代码）' },
  { id: 72, hex: '0x48', name: '指示物（连接死亡炮塔）' },
  { id: 4169, hex: '0x1049', name: '警逻指示物' },
  { id: 74, hex: '0x4a', name: '运动员指示物' },
  { id: 75, hex: '0x4b', name: '枪管指示物' },
  { id: 76, hex: '0x4c', name: '召唤指示物' },
  { id: 4173, hex: '0x104d', name: '信号指示物' },
  { id: 78, hex: '0x4e', name: '指示物（魂之灵摆）' },
  { id: 4175, hex: '0x104f', name: '蛊指示物' },
  { id: 80, hex: '0x50', name: '指示物（娱乐伙伴 掉头跑骑兵）' },
  { id: 81, hex: '0x51', name: '指示物（蜂军巢）' },
  { id: 82, hex: '0x52', name: '指示物（防火龙·暗流体）' },
  { id: 83, hex: '0x53', name: '指示物（炽天蝶）' },
  { id: 84, hex: '0x54', name: '指示物（星遗物引导的前路）' },
  { id: 85, hex: '0x55', name: '指示物（隐居者的大釜）' },
  { id: 86, hex: '0x56', name: '炎星指示物' },
  { id: 87, hex: '0x57', name: '幻魔指示物' },
  { id: 88, hex: '0x58', name: '指示物（祢须三破鸣比）' },
  { id: 89, hex: '0x59', name: '落魂指示物' },
  { id: 90, hex: '0x5a', name: '指示物（战吼试炼）' },
  { id: 91, hex: '0x5b', name: '指示物（北极天熊北斗星）' },
  { id: 4188, hex: '0x105c', name: '燃烧指示物' },
  { id: 93, hex: '0x5d', name: '指示物（机巧传-神使记纪图）' },
  { id: 94, hex: '0x5e', name: '皇之键指示物' },
  { id: 95, hex: '0x5f', name: '拼图指示物' },
  { id: 96, hex: '0x60', name: '指示物（北极天熊辐射）' },
  { id: 97, hex: '0x61', name: '指示物（命运的囚人）' },
  { id: 98, hex: '0x62', name: '指示物（逐渐削减的生命）' },
  { id: 4195, hex: '0x1063', name: '幻觉指示物' },
  { id: 100, hex: '0x64', name: 'G石人指示物' },
  { id: 4197, hex: '0x1065', name: '兔耳指示物' },
  { id: 102, hex: '0x66', name: '指示物（推荐捏军贯）' },
  { id: 103, hex: '0x67', name: '指示物（战斗车轮）' },
  { id: 104, hex: '0x68', name: '指示物（图腾柱）' },
  { id: 105, hex: '0x69', name: '指示物（吠陀-优婆尼沙昙）' },
  { id: 106, hex: '0x6a', name: '响鸣指示物' },
  { id: 4203, hex: '0x106b', name: '狂爱指示物' },
  { id: 108, hex: '0x6c', name: '访问指示物' },
  { id: 109, hex: '0x6d', name: '祝台指示物' },
  { id: 110, hex: '0x6e', name: '四季指示物' },
  { id: 111, hex: '0x6f', name: '龋齿指示物' },
  { id: 112, hex: '0x70', name: '盘子指示物' },
  { id: 113, hex: '0x71', name: '纠罪指示物' },
  { id: 4210, hex: '0x1072', name: '少女指示物' },
  { id: 115, hex: '0x73', name: 'T指示物' },
  { id: 116, hex: '0x74', name: '月轮指示物' },
  { id: 117, hex: '0x75', name: '贵宾指示物' },
  { id: 118, hex: '0x76', name: '指示物（大逆转箱）' },
  { id: 119, hex: '0x77', name: '冠指示物' },
  { id: 120, hex: '0x78', name: '万倍指示物' }
]

export const COUNTER_MAP: Record<number, string> = Object.fromEntries(
  COUNTER_DEFINITIONS.map((c) => [c.id, c.name])
)

/** 常用高频指示物代码 (优先展示在选择器顶层) */
export const COMMON_COUNTER_IDS = [
  0x1, // 魔力指示物
  0x1041, // 捕食指示物
  0x1002, // 楔指示物 (黑羽/疾风)
  0x3, // 武士道指示物 (六武众)
  0x1009, // 毒指示物 (蛇毒)
  0x100e, // A指示物 (外星人)
  0x1015, // 冰指示物 (冰结界)
  0x1019, // 雾指示物 (云魔物)
  0x1b, // 时计指示物 (钟楼)
  0x104c, // 信号指示物 (超重/加速同调)
  0x1055, // 歪曲指示物
  0x1001 // 通用指示物
]

export function getCounterName(id: number): string {
  return COUNTER_MAP[id] || `指示物(0x${id.toString(16)})`
}
