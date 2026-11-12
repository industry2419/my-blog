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

游戏页的「Steam 游戏库」区块同样属于**构建期快照平面**，展示总游玩时长、最近两周时长与成就完成度：

- 数据源：`IPlayerService/GetOwnedGames`（游戏库与时长）、`ISteamUserStats/GetPlayerAchievements`（前 N 款游戏的成就）；「游戏详情」需在 Steam 隐私设置中公开，否则只返回空列表。
- 凭据：仅从环境变量读取 `STEAM_API_KEY` 与 `STEAM_ID`（变量名可在 `gamesConfig.providers.steam` 覆盖），API Key 永不写入快照或日志。
- 启用：`gamesConfig.providers.steam.enable = true`；关闭时构建期不读取任何 Steam 文件，页面不输出区块。
- 同步命令：`pnpm games:steam`，支持 `--limit N`、`--if-stale`、`--no-achievements`、`--no-covers`、`--force`、`--dry-run`。
- 快照路径：`src/data/games-snapshots/steam.json`，封套为 `{ schemaVersion: 1, provider: "steam", fetchedAt, games }`，条目只保留白名单字段。
- 家庭共享补录：`GetOwnedGames` 不返回家庭共享游戏，这些游戏的时长只存在于本机 `localconfig.vdf`。开启 `providers.steam.localPlaytime` 后，同步脚本读取该文件的 `apps` 段（`Playtime`/`Playtime2wks`/`LastPlayed`），过滤掉已拥有条目，再写入 `src/data/games-snapshots/steam-local.json`（`provider: "steam-local"`）。构建期按 AppID 合并两份快照，在线条目优先，统一按总时长排序取前 `topGames` 款，因此共享游戏与自有游戏使用相同的卡片和时长展示。路径可用 `STEAM_ROOT` 或 `STEAM_LOCALCONFIG` 指定；CI 没有本机文件，只使用已提交的 `steam-local.json`，换机器玩的记录需在该机器重新同步。关闭该开关时不读取任何本地文件。
- 封面：优先下载商店头图；未公开商店页但已有库内美术的游戏回退到 `library_hero.jpg`，压缩为 WebP 后写入 `public/games-art/steam/<appId>.webp`；全部不可用时卡片退化为渐变占位。
- 降级：拉取失败或没有可展示游戏时保留上一次有效快照；文件缺失或 schema 不匹配时区块整体隐藏。
- 定时任务：`games-sync.yml` 在封面同步后追加 `games:steam`（`continue-on-error`），未配置 secrets 时脚本自行跳过。

---

## 6. 验收与质量基准

任何基于本规范新增或接入的远程数据模块，必须通过以下验收清单：
- [ ] **开关短路测试**：当 `enable: false` 时，构建产物中 0 请求、0 相关 DOM、0 额外依赖。
- [ ] **断网降级测试**：在完全无网络连接状态下运行 `pnpm build` 与启动站点，页面必须正常渲染且无未捕获异常。
- [ ] **Swup 代际切换测试**：在弱网慢速请求未完成时快速点击站内导航，旧请求必须被成功中断，新页面不受旧请求影响。
- [ ] **静态类型与代码质量**：通过 `npx.cmd astro check`、`pnpm.cmd exec biome ci ./src`。
