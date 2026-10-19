import { type JSX } from 'react'
import { useConfigStore } from '../../../stores/useConfigStore'
import { Switch } from '../../ui/switch'
import { SettingsRow } from './SettingsRow'

export function DuelSection(): JSX.Element {
  const { config, setRuleCheckEnabled } = useConfigStore()
  const enabled = config.ruleCheckEnabled !== false
  return (
    <section className="rounded-xl border border-border bg-card/60">
      <SettingsRow
        title="规则校验 (ygopro 式操作过滤)"
        description={
          '开启后点击卡片只显示 ocgcore 引擎判定合法的召唤 / 特殊召唤 / 盖放 / 发动 / 攻击 / 表示形式变更。' +
          '使用无脚本的自建卡或与引擎不兼容的局面时建议临时关闭，回到自由编辑'
        }
      >
        <Switch checked={enabled} onCheckedChange={(next) => void setRuleCheckEnabled(next)} />
      </SettingsRow>
    </section>
  )
}
