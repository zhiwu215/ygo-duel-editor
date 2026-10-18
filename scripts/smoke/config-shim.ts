/** 冒烟测试用 configService 替身（strings-service 只用 gameDirectory） */
export const configService = {
  get: () => ({
    gameDirectory: process.env.YGO_SMOKE_GAMEDIR || 'E:/MyCardLibrary/ygopro',
    extraCdbPaths: []
  })
}
