export interface AppInfoRow {
  label: string
  value: string
  href?: string
}

export interface ProjectCredit {
  name: string
  url: string
}

export const APP_INFO_ROWS: AppInfoRow[] = [
  { label: '作者', value: '知兀' },
  { label: '邮箱', value: 'zhiwu_215@qq.com' },
  {
    label: 'B 站',
    value: 'space.bilibili.com/3546704263514722',
    href: 'https://space.bilibili.com/3546704263514722'
  },
  {
    label: '项目地址',
    value: 'github.com/zhiwu215/ygo-duel-editor',
    href: 'https://github.com/zhiwu215/ygo-duel-editor'
  }
]

export const PROJECT_CREDITS: ProjectCredit[] = [
  { name: 'ygopro', url: 'https://github.com/Fluorohydride/ygopro' },
  { name: 'edopro-kcg', url: 'https://github.com/knight00/KCGEdopro' },
  { name: 'neos-ts', url: 'https://github.com/DarkNeos/neos-ts' },
  { name: 'MDPro3', url: 'https://code.moenext.com/sherry_chaos/MDPro3/-/tree/master' },
  { name: 'DataEditorY', url: 'https://github.com/kkr223/DataEditorY' }
]
