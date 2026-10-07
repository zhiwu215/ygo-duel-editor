# 卡池判定与 ot 位

卡池筛选（动漫/漫画、超速、卡片力量）和 OCG / TCG 角标到底按什么判定？为什么同一组筛选在官方 ygopro、EDOPro-KCG 和本项目里数量对不上？下面按实际遇到的问题逐条整理。

结论先放这里：**一律看卡片数据里的 `ot` 位，与「这张卡在哪个 cdb 文件里」无关**。

## 「TCG 独有」在本项目 27 张、EDOPro-KCG 24 张、官方 ygopro 23 张

用 Python `sqlite3` 只读直连三个库，复刻项目里的筛选口径（排除 Token、占位符、产品说明等非卡牌行，并要求 `texts` 里有对应记录）后，三个数字都能复现：

| 工具 | 数字 | 实际读的库 | 该库 TCG 独有 |
| --- | --- | --- | --- |
| 官方 ygopro | 23 | `E:\MyCardLibrary\ygopro\cards.cdb` | 23 |
| EDOPro-KCG | 24 | `E:\Edopro-kcg\cdb\cards.cdb` | 24 |
| 本项目 | 27 | 上面那个主库 + 附加库 `config\languages\Chs\anime.cdb` | 23 + 4 = 27 |

**23 与 24 不是筛选口径的差异，是两份 `cards.cdb` 的数据差异。** 两份 tcgOnly 名单只差一张卡——「胜利之风」(37301660)：在 MyCardLibrary 那份里 `ot=3`（OCG + TCG 双赛区），在 KCG 那份里 `ot=2`（TCG 独有）。顺带一提，两份库同 id 但 `ot` 不同的卡有 **8263 张**（MyCardLibrary 大量卡是 `ot=11`、KCG 同卡是 `ot=3`），说明中文版 cdb 往 `ot` 里塞了自己的私有位，标准 YGOPro 只认 bit1 / bit2。

**本项目多出来的 4 张全部来自 anime 附加库**，且与主库 id 零交集，所以是纯相加：

| 卡密 | 卡名 | ot |
| --- | --- | --- |
| 17412731 | 旧实体诺登（alias 指向 17412721 旧神 诺登） | 2 |
| 25862691 | 古代妖精龙(Pre-Errata) | 2 |
| 33900658 | 清透世界(Pre-Errata) | 2 |
| 96782896 | 心灵大师 | 2 |

它们都是 `id = 原卡 id + 10`、`alias` 指回原卡的「改版」条目，主库里完全不存在。

**EDOPro 为什么没被这 4 张污染**：同样这 4 个 id，在 `E:\Edopro-kcg\cdb\cards-unofficial.cdb` 里 `ot=8`（名字带 `(Pre-Errata)`），不命中 TCG 位，所以 EDOPro 仍是 24。也就是说，本项目当时把 KCG 的**语言包目录**（`config/languages/<lang>/*.cdb`）当成附加卡库加载了，而语言包里的 `datas` 与真库重复、字段值还不一致。

## 为什么动画/漫画卡会带上 TCG 角标

因为「TCG」和「ANIME」是**两个互不相干的维度**：

- **ANIME 角标**来自「这张卡在哪个 cdb 文件里」（附加卡库的标记）
- **TCG 角标**来自卡片数据里的 `ot` 位（bit2）

一个卡片条目可以同时命中两边，所以同一个条目上会同时出现两个角标。上面那 4 张的 `ot` 恰好被写成了 2，于是它们既是 anime 库的卡、又命中 TCG 独有。

## 为什么「卡片力量」的卡被显示成「动漫/漫画」

同一个根因的另一种表现。以「贤者之石-萨巴希尔」为例：

- `100000247 贤者之石-萨巴希尔(TF)`：EDOPro-KCG 显示 **VG 图标 + `[卡片力量(TF)]`**，本项目当时显示 **ANIME 图标 + `[动漫/漫画]`**
- `513000057 贤者之石-萨巴希尔(Anime)`：两边都显示 ANIME 图标

差别在于判定依据：EDOPro 看**每张卡自己的 `ot` 位**，本项目当时看**卡在哪个库**——而 anime.cdb 这个文件里同时装着动漫卡、卡片力量(VG)卡和旧文本版卡，整库打一个标记必然串味。

## ot 位的真实语义

用真库 `E:\Edopro-kcg\cdb\*.cdb` 反推（语言包不可信，原因见下）：

| ot 位 | 值 | 语义 | 证据 |
| --- | --- | --- | --- |
| 0x1 / 0x2 | 1 / 2 | OCG / TCG | 标准位 |
| 0x4 | 4 | 动漫/漫画 | `cards-unofficial.cdb` 4955 条；主库该位全为 0 |
| 0x8 | 8 | 中文改版私有位（KCG 里对应旧文本版） | anime.cdb 367 条几乎全带 `(Pre-Errata)` |
| 0x10 | 16 | 卡片力量（VG/TF） | 520 条样例全是 `(VG)` |
| 0x40 | 64 | 技能卡 | `cards-skills.cdb` |
| 0x200 | 512 | 超速（Rush） | `cards-rush.cdb` 3357 条全带 `(Rush)` |
| 0x1000 | 4096 | 骑乘/动作卡段 | 4100 = 0x1004、4608 = 0x1200 |

`0x8` 的含义**随改版而异**：KCG 的 anime.cdb 里它高度对应 `(Pre-Errata)`，但 MyCardLibrary 的主库里 8263 张卡都带这一位，显然不是同一回事。项目不使用这一位。

三个附加池位在真库里**完全正交**（主库 `cdb/cards.cdb` 与 `MyCardLibrary/ygopro/cards.cdb` 的 ot&4 / ot&16 / ot&512 全为 0，unofficial 只有 4 和 16，rush 只有 512），比按库标记干净得多。

## 当初「ot 位切不干净」的结论错在哪

早先的判断是「`ot & 0x10` 是混合桶：301 条里只有 51 条卡名带 `(TF)`、28 条带 `(Anime)`、剩下 222 条两者都不带，切不出卡片力量」。这个前提是错的——那 28 条在真库里**名字其实是 `(VG)`**：

| 卡密 | 语言包里的卡名 | 真库里的卡名 |
| --- | --- | --- |
| 100000001 | 牵手魔人(Anime) | Hand-Holding Genie (VG) |
| 100003002 | 电子化天使-弁天-(Anime) | Cyber Angel Benten (VG) |
| 100000247 | 贤者之石-萨巴希尔(TF) | Sabatiel - The Philosopher's Stone (VG) |

**`ot=16` 是对的，错的是语言包给它们标的名字后缀。** 所以「这一位是混合桶」不成立，`ot` 位完全可以用来切卡池。

## 为什么 KCG 的 `config/languages/*.cdb` 不能当数据来源

它们是**中文文本包**，`datas` 与真库重复，而且 `ot` 值、卡名后缀都可能与真库不一致：

- `ot` 不一致：4 张 Pre-Errata 卡在语言包是 `ot=2`，真库是 `ot=8`
- 卡名后缀不一致：28 张 VG 卡在语言包被标成 `(Anime)`
- `ot` 大面积丢失：`anime.cdb` 有 229 行 `ot=0`，真库同样这些行是 `ot=16`（详见后面「语言包把 229 张卡的 ot 丢成了 0」）
- 数据不完整：语言包 `rush.cdb` 有 385 条 `ot=0`，真库 `cdb/cards-rush.cdb` 里它们都带 512 位

它们只适合当**中文名来源**。判 `ot` 语义、判「卡到底属于哪个池」，要拿 `E:\Edopro-kcg\cdb\*.cdb` 做基准。

## 语言包把 229 张卡的 ot 丢成了 0

语言包的 `datas` 并不是空壳——除了 `ot`，其他列与真库逐格对得上。以卡密 `100000040` 为例：

| 字段 | 真库 `cdb/cards-unofficial.cdb` | 语言包 `config/languages/Chs/anime.cdb` |
| --- | --- | --- |
| 卡名 | Infinity Force (TF6) | 无限之力(TF) |
| **ot** | **16** | **0** |
| type | 4 | 4 |
| atk / def / level | 0 / 0 / 0 | 0 / 0 / 0 |
| category | 2 | 2 |

整库统计也一致（`atk = 0` 的行占 64.5% vs 65.4%、`level = 0` 占 57.9% vs 58.5%……），**唯独 `ot`：语言包 229 行是 0，真库只有 1 行**，差的 228 行正好就是那批「卡片力量」卡。

所以这不是有人有意清空，而是这一列没人维护。语言包的职责只有 `texts`（卡名与效果文），`datas` 是顺带带的。

后果：

- 语言包 `ot = 0` 的 499 张（应用口径）里，**474 张在真库是 `ot = 16`**，另有 1 张 `ot=20`、3 张 `ot=4`、9 张 `ot=4100`、2 张 `ot=4112`、5 张 `ot=8`、5 张真库没有。
- 「卡片力量」：真库 515 张 → 语言包只认出 295 张。差的 228 张里 188 张语言包 `ot=0`、40 张语言包 `ot=4`，**真正缺失的是 0 张**；语言包独有的 `ot&16` 卡只有 8 张。
- 「动漫/漫画」受影响很小：真库 5028、语言包 5146、交集 5011、并集 5163，语言包只差 17 张。
- 这些卡在「全部卡池」下按卡名仍能搜到（中文名也在），只是不出现在对应筛选里。

## 多库按 id 首次命中即返回

`CdbService.search()` 用 `seen` 集合去重，`connections` 的顺序是「主库 + `extraCdbPaths` 的配置顺序」，同一个卡密**第一次命中就返回**，后面的库不再看。

所以语言包排在真库前面时，它那份 `ot = 0` 会一直赢：**只把真库追加到附加库列表末尾不会有任何改善**，必须移除语言包（或把它排到真库后面，但那样卡名会变成英文）。`addExtra()` 也只是追加到 `connections` 末尾，不改变已加载库的优先级。

## EDOPro 那 6375 张从哪来

真库 + 语言包全挂上，按本项目的过滤口径是 6720 张，已经比 EDOPro 的 6375 还多；穷举 2^12 种库组合都凑不出 6375。多出来的那部分来自 **KCG 自己的扩展库**，它们都在 `config/languages/Chs/` 与 `repositories/kcg/` 下：

| 库 | `ot&4` 张数 |
| --- | --- |
| `config/languages/Chs/KCG.cdb` | 734 |
| `config/languages/Chs/neet.cdb` | 827 |
| `repositories/kcg/fixanime.cdb` | 25 |

这三个库一张都没挂，所以 5146 与 6375 的差额里有一大截是它们。

## 到底哪一层出了问题

| 环节 | 结论 | 依据 |
| --- | --- | --- |
| 筛选与角标逻辑 | 没问题 | 主库 + 语言包按项目口径算出 5146 / 295，与界面数字分毫不差；换成真库口径是 515 张，比 EDOPro 的 512 还多 3 张 |
| 附加卡库的选择 | 选错了 | 挂的是中文文本包，EDOPro 读的是 `cdb/cards-unofficial.cdb` |
| 跨库合并能力 | 缺失 | 项目没有「`datas` 取真库、`texts` 取语言包」的能力，所以只能在准确数据与中文卡名之间二选一 |

当前决定：不实现跨库合并。需要完整数据时，把附加库换成 `E:\Edopro-kcg\cdb\cards-unofficial.cdb`，代价是卡名变英文。

## 最终采用的口径

卡池判定统一改成按 `ot` 位，与卡库无关：

- 动漫/漫画 = `ot & 0x4`
- 卡片力量（TF）= `ot & 0x10`
- 超速（Rush）= `ot & 0x200`
- OCG / TCG 可用与独有沿用 `ot & 0x1` / `ot & 0x2`

代码位置：

- `src/shared/types/card.ts`：`AVAIL_*` 位常量、`CARD_POOLS[].otMask`、`CARD_POOL_OT_MASKS`、`cardPoolOtMask()`、`cardPoolIdsFromOt()`
- `src/main/db/cdbService.ts`：`applyCardPools()` 推导角标；`searchOne()` 里 `AND (d.ot & ?) != 0` 做筛选；`getSearchFilterOptions().availablePools` 改为逐库探测该 `ot` 位是否存在
- 渲染层不需要改动：角标与筛选项可见性都走 `card.pools` / `availablePools` 两个通道，语义自动跟随

同时**删掉了「按卡库标记判定」的整套设施**（`cdbPoolTags` 配置项、`cdb:set-pool-tag` IPC、设置窗口的「卡库卡池标记」下拉、`CdbService.setPoolTags()` 与 `CdbConnection.poolId`），因为它已不再参与任何判定。

实测（主库 MyCardLibrary + 附加库 `config\languages\Chs\anime.cdb`，rush 库已停用）：

| 筛选 | 命中 |
| --- | --- |
| 动漫/漫画 | 5146 |
| 卡片力量（TF） | 295 |
| 超速（Rush） | 0（未加载对应库，筛选项隐藏） |
| TCG 独有 | 23（主库）+ 4（anime 库）= 27 |

角标核对：`贤者之石-萨巴希尔(TF)` → VG 图标 + `[卡片力量（TF）]`，`(Anime)` 版 → ANIME 图标，与 EDOPro 一致。原先被误标的一批也归位——4 张 `ot=2` 的和 367 张 `ot=8` 的 `(Pre-Errata)` 卡不再挂动漫/漫画角标。

一个曾经试过又否决的兜底规则：曾写「卡片不含任何池位时回退到所属卡库的标记」，实测会把 367 张 `(Pre-Errata)`（`ot=8`）和 4 张 `ot=2` 的卡也标成动漫/漫画，比 EDOPro 更脏，已删除。
