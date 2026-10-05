# 供应商品牌图标

本目录存放模型供应商的**品牌标识图**，用于「设置 → 背后灵 → 模型设置」中的供应商列表与详情页展示。

## 来源与授权

这些图标均为**各厂商官方的注册商标**，著作权 / 商标权归各品牌方所有：

- DeepSeek、Moonshot AI (Kimi)、Alibaba Cloud (通义千问) 等
- OpenAI、Anthropic、xAI、MiniMax、Xiaomi MiMo、Z.AI、BigModel
- OpenRouter、OpenCode、Start Plan

**商标不随本项目或上游项目的开源协议转让。** 本目录仅用于标识「本产品兼容 / 支持该厂商服务」，不代表任何合作或授权关系。

## 文件来源

素材取自各厂商官方 brand 页（具体 URL 与获取日期见 `model-provider-logo-sources.json`），**未做任何修改**。该 JSON 记录了每个文件对应的品牌、来源地址与获取时间。

## 使用约定

`ProviderLogo.tsx`（`src/renderer/src/components/Settings/components/`）通过 `presetId` 查表映射到具体文件，加载失败时依次回退：品牌图 → 预设的 `badge` 文字缩写 → 通用盒子图标。

**新增供应商预设时**，若需要品牌图：

1. 从厂商官方 brand 页获取，放入本目录
2. 在 `LOGO_ASSETS` 中登记键名（建议用预设 `id`，可用别名覆盖同品牌的不同预设）
3. 在 `model-provider-logo-sources.json` 中补充一条来源记录

若不提供品牌图也可正常工作，只是会显示 `badge` 文字。
