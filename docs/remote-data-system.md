# Shirone 远程数据与扩展基础设施规范 (Remote Data System)

> **状态**：正式规范（Frozen Specification）  
> **适用范围**：全站所有涉及外部网络请求、远端 API、构建期数据抓取、运行时客户端拉取与未来字体远程子集化分析的统一契约。  
> **核心原则**：严格遵循「零额外负担」原则——当功能禁用或未配置时，保证**零外部网络请求、零占位 DOM、零性能损耗、零主包体积膨胀**。

---

## 1. 架构定位与双平面模型

Shirone 将全站所有远程数据流严格划分为两个独立的物理平面：

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. 构建期快照平面 (Build-time Snapshot Plane)                            │
│    - 典型场景：Bangumi / Bilibili 追番数据抓取、构建期全量字符集分析      │
│    - 链路：CLI/CI → Remote API → Schema 校验与清洗 → JSON 快照 → Astro 构建 │
│    - 约束：纯静态化、严禁运行时轮询、私密凭据仅限 Node 构建环境               │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ 2. 运行时按需平面 (Runtime On-Demand Plane)                               │
│    - 典型场景：Meting 侧栏音乐歌单、Twikoo 评论按需加载、第三方搜索/统计    │
│    - 链路：用户交互/视口触发 → Client Island → Remote Data Client → 状态管理│
│    - 约束：必须支持 AbortController 取消、请求去重、Swup 页面切换代际隔离     │
└─────────────────────────────────────────────────────────────────────────┘
```

两平面严禁混淆职责：**构建期快照不得泄漏任何 Token 到浏览器；运行时按需平面不得阻塞首屏 SSR 渲染。**

---

## 2. 通用网络与请求契约

全站所有需要发起网络请求的模块（无论客户端还是 Node 脚本），必须统一遵循以下核心规范：

### 2.1 请求生命周期与代际保护
1. **超时熔断**：每个请求必须设定显式 `timeout`（客户端按需平面默认 ≤ 8s，构建期 API 默认 ≤ 15s），超时必须使用标准 `AbortSignal.timeout()` 或 `AbortController` 彻底终止底层套接字。
2. **Swup 站内导航代际保护（Generation Lock）**：
   - 客户端发起的异步请求必须绑定当前页面代际 ID（`generation`）。
   - 当 Swup 触发 `content:replace` 或页面切换时，尚未返回的旧页面请求必须被自动 `abort()`；若请求已在链路中无法取消，返回时检测到代际过期必须丢弃响应，**严禁跨页面回写 DOM 或污染新页面状态**。
3. **并发去重（In-flight Deduplication）**：
   - 同一 URL 与参数的并发请求必须共享同一个 `Promise`，防止短时间内高频触发多个相同请求。

### 2.2 响应校验与字段白名单
1. **HTTP 状态与 Content-Type**：必须显式验证 `response.ok` 与符合预期的 `Content-Type`（如 `application/json`）。
2. **Schema 安全解析**：必须对返回数据做运行时 Schema 验证（或字段白名单清洗），过滤非法字段与未知超长字符，保证进入 UI 组件的数据完全类型化且不可变。
3. **响应体体积上限**：客户端单个 JSON 响应体不得超过 512KB；构建期 API 响应体不得超过 5MB。

### 2.3 失败降级与重试机制
1. **指数退避重试**：网络抖动时允许最多重试 1 次，重试间隔须采用指数退避（Backoff），严禁死循环重试。
2. **静默降级原则**：
   - 音乐：远端 API 失败时，无感降级为本地曲目（`src/data/music.ts`），绝不破版。
   - 番剧：抓取失败或返回空列表时，默认保留上一次成功的版本化快照（`snapshot.keepLastValid`；`anime:sync` 跳过覆盖、打印警告并以退出码 0 结束，设为 `false` 关闭保护）或显示友好空状态。
   - 评论：服务不可用时，优雅提示并提供重试入口，不得影响文章主体渲染与滚动。

---

## 3. 字体子集化与远程数据的边界规范

字体系统（`docs/font-system.md`）涉及字形提取与子集压缩，针对远程数据的介入，制定以下铁律：

### 3.1 默认离线输入原则
- 默认情况下，字体子集化只能使用**本地确定性输入**：
  1. `src/content/` 下全部 Markdown / MDX 文章正文；
  2. `src/i18n/languages/` 下全部 10 种语言词典；
  3. `src/config/` 中的站点名称、描述、导航等静态配置；
  4. 通用基础标点与高频字符集。

### 3.2 远程数据参与子集化的边界
- 字体子集化会读取远端文本，但仅限一类数据：Meting 云端歌单的曲目标题，
  且必须同时满足 `allowRemoteText` 为 `true`、`musicConfig.enable` 为真、
  provider 为 `meting` 或 `mixed`。除此之外不发起任何远程请求。
- **番剧名称、动态内容等其余远端数据不得参与字体子集化。** 它们要先通过独立的数据拉取
  命令（如 `pnpm fetch:remote-data`）抓取并清洗为版本化的本地 JSON 快照
  （如 `src/data/snapshots/*.json`），子集化脚本只读取落盘快照。
- 该抓取的失败只产生告警并退化为仅使用本地文本，不会中断构建。

---

## 4. 安全、隐私与脱敏规范

1. **凭据安全**：API Key、Private Token、Webhook Secret 等必须通过服务端环境变量（`process.env.*`）传递，**严禁直接暴露在客户端代码、公开配置或 Git 提交中**。
2. **URL 脱敏**：请求日志、错误堆栈和控制台警告中，必须对包含 `access_token`、`secret`、`password` 等 Query 参数的 URL 统一执行正则表达式脱敏。
3. **零追踪原则**：不引入未经用户许可的第三方重型追踪脚本。

---

## 5. 目录与分层规划（供未来统一重构参考）

当未来全站全面抽取通用远程数据工具层时，推荐按以下结构统一组织，避免在各个组件内各自实现 `fetch`：

```text
src/utils/remote-data/
  client.ts          # 统一 fetch 请求执行、超时与 AbortSignal 管理
  cache.ts           # 内存 LRU 请求缓存与并发去重
  errors.ts          # 结构化错误类型，不硬编码 UI 文案
  lifecycle.ts       # 代际计数器与 Swup 路由切换自动取消
  policy.ts          # 白名单策略与响应体预算
  index.ts           # 导出统一 client 接口
```

---

### 5.1 游戏资历快照（Enka.Network）

游戏页的资历数据（账号等级 / 成就 / 高难战绩）属于**构建期快照平面**：

- 数据源：Enka.Network 公开只读接口（`https://enka.network/api/{uid}/`、`/hsr/uid/`、`/zzz/uid/`），无需 Cookie、签名或设备指纹；前置条件是玩家在游戏内开启「公开角色详情」，否则接口返回 404。
- 同步命令：`pnpm games:sync`，支持 `--game genshin|starrail|zenless|all`、`--if-stale`、`--dry-run`。
- 快照路径：`src/data/games-snapshots/enka.json`，封套为 `{ schemaVersion, provider, fetchedAt, accountRef, credentials }`；`uid` 仅用于抓取与审计，合并时会剥离，不进入页面 DOM。
- 运行时契约：页面只读本地快照；`source.kind` 为 `local`、文件缺失或 schema 不匹配时不读取快照，也不发起任何请求。
- 降级：接口失败时保留上一次有效快照（`keepLastValid`），只有配置为 `false` 时才允许写入空快照。
- 版本封面：`pnpm games:covers` 从米游社官方账号的「版本PV」视频帖封面抓取当前版本主视觉，校验为横屏大图后转成 WebP，写入 `public/games-art/<gameId>.webp`，并生成 `src/data/games-snapshots/covers.json`。构建期该映射优先于内容仓手填的 `cover`；同步失败或文件缺失时静默回退，不产生运行时请求。
- 定时任务：`.github/workflows/games-sync.yml` 每天先跑 `games:sync`，再跑 `games:covers`，把快照与封面一并提交回仓库。

### 5.2 Steam 游戏库（Steam Web API）

游戏页按数据来源分组展示（miHoYo / Steam），Steam 分组同样属于**构建期快照平面**，展示总游玩时长、最近两周时长与成就完成度；页内搜索只过滤本页游戏，不触发站点级搜索：

- 数据源：`IPlayerService/GetOwnedGames`（游戏库与时长）、`ISteamUserStats/GetPlayerAchievements`（全部游戏的成就）；「游戏详情」需在 Steam 隐私设置中公开，否则只返回空列表。
- 凭据：仅从环境变量读取 `STEAM_API_KEY` 与 `STEAM_ID`（变量名可在 `gamesConfig.providers.steam` 覆盖），API Key 永不写入快照或日志。
- 启用：`gamesConfig.providers.steam.enable = true`；关闭时构建期不读取任何 Steam 文件，页面不输出区块。
- 同步命令：`pnpm games:steam`，支持 `--if-stale`、`--no-achievements`、`--no-covers`、`--no-tags`、`--force`、`--dry-run`。快照始终写入全部游戏（含 0 分钟的自有游戏），封面、成就与标签也覆盖全部条目。
- 快照路径：`src/data/games-snapshots/steam.json`，封套为 `{ schemaVersion: 1, provider: "steam", fetchedAt, games }`，条目只保留白名单字段。
- 展示上限：`providers.steam.topGames`（1–200，默认 200）只控制构建期渲染数量，不影响快照写入；默认即全部展示。
- 状态徽章：构建期由 `deriveSteamStatus` 依据快照事实推导，不写入快照——最近两周有游玩 → 正在游玩；成就全部达成 → 已通关；其余（未启动或玩过但已停）→ 积压待玩。Steam 库不使用「退坑弃游」，该状态只出现在手动维护的游戏数据中。
- 主要标签：同步时逐款查询 `store.steampowered.com/api/appdetails` 的 `genres`，过滤「Free To Play / Early Access」后每款保留 2–3 个标签写入快照 `tags`，卡片以 chips 展示；商店 genres 不足 2 个时用快照里的旧值（人工补充）补齐，抓取失败时同样沿用旧值（`--no-tags` 可跳过请求，仅保留旧值）。
- 家庭共享补录：`GetOwnedGames` 不返回家庭共享游戏，这些游戏的时长只存在于本机 `localconfig.vdf`。开启 `providers.steam.localPlaytime` 后，同步脚本读取该文件的 `apps` 段（`Playtime`/`Playtime2wks`/`LastPlayed`），过滤掉已拥有条目，再写入 `src/data/games-snapshots/steam-local.json`（`provider: "steam-local"`）。写入前会与已有补录打补丁：新记录更小或缺失时保留旧条目（视为另一台电脑的记录），更大时才更新；已补购、出现在 `GetOwnedGames` 中的条目从补录移除，改由 Steam 云端数据接管。构建期按 AppID 合并两份快照，在线条目优先，统一按总时长排序展示；补录条目带运行时 `local` 标记，卡片在时长后显示「（本机记录）」，与云端数据区分。路径可用 `STEAM_ROOT` 或 `STEAM_LOCALCONFIG` 指定；CI 没有本机文件，只使用已提交的 `steam-local.json`，换机器玩的记录需在该机器重新同步。关闭该开关时不读取任何本地文件。
- 封面：优先下载商店头图；未公开商店页但已有库内美术的游戏回退到 `library_hero.jpg`，压缩为 WebP 后写入 `public/games-art/steam/<appId>.webp`；全部不可用时卡片退化为渐变占位。
- 降级：拉取失败或没有可展示游戏时保留上一次有效快照；文件缺失或 schema 不匹配时区块整体隐藏。
- 定时任务：`games-sync.yml` 在封面同步后追加 `games:steam`（`continue-on-error`），未配置 secrets 时脚本自行跳过。

### 5.3 B 站动态（RSSHub）

动态页的手写内容仍在 `content/moments/`；B 站动态属于**构建期快照平面**，与手写动态合并为同一条时间流：

- 数据源：公共或自建 RSSHub 实例的 `/bilibili/user/dynamic/:uid` Feed，无需 Cookie 与签名。
- 启用：`momentsConfig.bilibili.enable = true` 且 `uid` 非空；任一条件不满足时脚本直接跳过，构建期不读取快照，页面只展示手写动态。
- 同步命令：`pnpm moments:sync`，支持 `--dry-run`、`--uid`、`--base-url` 临时覆盖。
- 快照路径：`src/data/bilibili-moments.json`，封套为 `{ schemaVersion: 1, provider: "bilibili", uid, fetchedAt, items }`；条目只保留 `id/published/content/url/images`。构建期会校验快照 `uid` 与当前配置一致，切换账号后不会串用旧账号数据。
- 配图：下载后统一转为最长边 1600px 的 WebP，写入 `public/images/moments/bilibili/`，文件名包含动态 ID、序号与源地址摘要；源地址不变时幂等复用，快照写入成功后清理不再引用的旧图。该目录登记在 `PROTECTED_PATHS`，内容同步不会覆盖或导出它。
- 展示：与手写动态按发布时间倒序合并，`pinned` 仍置顶；同步条目带「来自 B 站」徽章和原文链接，标签由 `bilibili.tags` 追加（内容仓示例配置为 `B站`），可在动态页筛选。
- 降级：Feed 抓取失败或返回空时，`keepLastValid: true` 保留上一份有效快照并以退出码 0 结束；没有有效快照时才以非 0 退出。
- 定时任务：`.github/workflows/moments-sync.yml` 每天运行 `moments:sync`，把快照与配图提交回仓库；也可用 `workflow_dispatch` 手动触发。公共实例不稳定时可在内容仓 `config/moments.yaml` 中替换 `rsshubBaseUrl`。

### 5.4 飞书动态发布（移动端写作入口）

§5.3 是「只读聚合别人平台的动态」；这一节是「自己在手机上写动态」的发布入口，两者互不依赖。

- 数据源：飞书自建应用（机器人）所在会话的最近消息，用 `im/v1/messages` 分页拉取，不需要公网回调地址，也不需要 Cookie。
- 应用权限：读取消息（`im:message`；群聊历史需 `im:message.group_msg`）与下载图片资源（`im:resource`），另外用 `im:chat:readonly` 列出机器人所在群以取得 `chat_id`。建议单独建一个只放自己和机器人的群，避免把其他成员的消息发布出去。
- 启用：配置 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_CHAT_ID` 三个 secret；缺失时 `moments:feishu` 打印 notice 并以 0 退出，不产生任何写入（零额外负担）。
- 发布命令：`pnpm moments:feishu`，支持 `--content-dir`、`--dry-run`、`--since-hours`（默认 7 天）、`--gap-minutes`（默认 5）、`--grace-minutes`（默认 10）。
- 落点：内容仓 `content/moments/<北京日期>-feishu-<消息ID>.md`；配图下载原始格式到内容仓 `public/images/moments/feishu/`，缩略图按既有 moments 管线在构建期生成，无需额外格式转换。
- 合并规则：同一发送者 `gap-minutes` 内的连续文字与图片合并为一条动态；分组键固定为该组首条消息 ID，因此重复轮询完全幂等，已存在的文件不会覆盖。`/skip` 开头的消息忽略，`/draft` 开头写入草稿，消息末尾只由 `#标签` 组成的行搬进 frontmatter `tags`。
- 降级：单张图片下载失败只跳过该图，正文照常发布；接口或鉴权失败以非 0 退出，由 Actions 报错；内容仓目录缺失时直接失败而不是写到代码仓。
- 定时任务：`.github/workflows/moments-feishu.yml` 每 30 分钟轮询一次（GitHub cron 可能延迟），把新动态提交到内容仓。`CONTENT_REPO_TOKEN` 必须对内容仓拥有 `Contents: Read and write`。
- 常见错误：获取 `tenant_access_token` 返回 `21001 Access denied due to platform policy` 时，凭据本身通常是对的（secret 错误会返回 `10014`），问题出在租户或应用状态：多为用豆包/第三方一键登录创建的个人租户，或应用被停用、应用类型不是「企业自建应用」。换用手机号注册的正常团队租户重建应用即可。
- 生效前提：内容仓收到推送后仍需触发站点重建。可在内容仓启用 `trigger-build.yml`（`repository_dispatch`）或配置托管平台的部署钩子。

---

## 6. 验收与质量基准

任何基于本规范新增或接入的远程数据模块，必须通过以下验收清单：
- [ ] **开关短路测试**：当 `enable: false` 时，构建产物中 0 请求、0 相关 DOM、0 额外依赖。
- [ ] **断网降级测试**：在完全无网络连接状态下运行 `pnpm build` 与启动站点，页面必须正常渲染且无未捕获异常。
- [ ] **Swup 代际切换测试**：在弱网慢速请求未完成时快速点击站内导航，旧请求必须被成功中断，新页面不受旧请求影响。
- [ ] **静态类型与代码质量**：通过 `npx.cmd astro check`、`pnpm.cmd exec biome ci ./src`。
