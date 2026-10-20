/** 冒烟测试用 configService 替身(strings-service/currentLanguagePackPaths 只用 gameDirectory/gameType/gameLanguage) */
export const configService = {
  get: () => ({
    gameDirectory: process.env.YGO_SMOKE_GAMEDIR || 'E:/MyCardLibrary/ygopro',
    extraCdbPaths: [],
    gameType: process.env.YGO_SMOKE_GAMETYPE as 'ygopro' | 'mdpro3' | undefined,
    gameLanguage: process.env.YGO_SMOKE_GAMELANG
  })
}
