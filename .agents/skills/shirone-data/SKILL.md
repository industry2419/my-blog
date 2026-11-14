---
name: shirone-data
description: Managing Shirone data-backed pages and albums - adding or editing album folders, info.json metadata, local or external photos, friends, compass, anime, projects, skills, devices, games, timelines, and music data. Use when changing content outside src/content/ that feeds these pages.
---

# Shirone 数据与相册

## 先判断归属

- 文章和动态写入 `src/content/`，使用 `shirone-writing`。
- 页面行为、开关、排序和凭据写入 `src/config/`，使用 `shirone-config`。
- 具体条目内容写入 `src/data/`；不要把内容实体塞进 config。
- 相册不是 Content Collection，而是 `public/images/albums/` 下的目录数据。

## 数据页工作流

1. 先阅读对应类型和数据文件：`src/types/<domain>Config.ts`、`src/data/<domain>.ts`，确认字段和现有条目形状。
2. 只修改内容实体；筛选、排序、页面开关使用对应 `src/config/*Config.ts` 的 `categories`、`disabledKeys`、`order` 和 `enable`。
3. 新增条目后运行 `npx.cmd astro check`、`pnpm.cmd check:manifest`，并执行对应页面测试，例如 `tests/site/friends.spec.ts`、`tests/site/anime.spec.ts`、`tests/site/projects.spec.ts`、`tests/site/devices.spec.ts`、`tests/site/games.spec.ts`、`tests/site/timeline.spec.ts`。
4. 游戏资历快照由 `pnpm.cmd games:sync` 通过 Enka.Network 公开接口生成到 `src/data/games-snapshots/`；同步前需在游戏内开启「公开角色详情」，不要手改快照。当前版本封面由 `pnpm.cmd games:covers` 从米游社官方版本 PV 同步到 `public/games-art/` 与 `src/data/games-snapshots/covers.json`，同样不要手改；内容仓里的 `cover` 仅作为同步失败时的回退。
5. Steam 游戏库由 `pnpm.cmd games:steam` 通过 Steam Web API 生成到 `src/data/games-snapshots/steam.json`，头图写入 `public/games-art/steam/`。先设置 `gamesConfig.providers.steam.enable = true`，并在 `.env` 或 CI Secrets 中配置 `STEAM_API_KEY` 与 `STEAM_ID`（SteamID64），同时把 Steam「游戏详情」设为公开；API Key 不会进入快照。每款游戏的主要类型标签（2–3 个）由同步脚本从商店 `appdetails` 的 `genres` 抓取并写入快照 `tags`，genres 不足 2 个时用旧值补齐，抓取失败时同样沿用旧值（`--no-tags` 跳过抓取）。
6. 家庭共享游戏的时长只有本机 `localconfig.vdf` 记录。开启 `providers.steam.localPlaytime` 后，同步脚本会在本机读取该文件，把非本人拥有但有游玩记录的游戏写入 `src/data/games-snapshots/steam-local.json`（同样不要手改）。写入前会与已有补录合并：本机记录更小或缺失时保留旧条目（视为另一台电脑），更大时才更新；已补购的游戏移出补录、改由 Steam 数据接管。页面在补录游戏的时长后标注「（本机记录）」。`STEAM_ROOT` 指向 Steam 安装目录（如 `D:/steam`），`STEAM_LOCALCONFIG` 可直接指定文件路径；两者都未设置时，Windows 会查询注册表，再由 `STEAM_ID` 换算 userdata 目录。CI 没有本机记录，只使用已提交的 `steam-local.json`；换机器玩家庭共享游戏需在新机器重新运行同步。

## 相册工作流

每个相册是 `public/images/albums/<id>/` 目录：

- 本地照片模式需要 `info.json`、`cover.webp` 或 `cover.jpg`，其余图片直接放在同目录；文件名可用 `标题_标签1_标签2.ext`。作者与出处用 `credits` 按文件名声明：`"credits": { "01.webp": { "author": "画师名", "source": "https://..." } }`。
- 外部照片模式在 `info.json` 设置 `"mode": "external"`、`cover` 和 `photos` 数组；每个照片至少提供 `src`，可选 `thumbnail`、`alt`、`title`、`tags`、日期、相机信息以及 `author`、`source`。
- 网格缩略图左下角标签规则：`source` 为 http(s) 链接时点击跳转，文字优先 `author`、否则域名；仅有 `author` 时显示作者名；都没有时显示 `AI`（`I18nKey.imageAiLabel`）。
- `title`、`description`、`date`(YYYY-MM-DD)、`location`、`tags`、`layout`(`masonry`/`grid`)、`columns`(2/3/4)、`hidden`、`password` 和 `passwordHint` 按 `src/types/album.ts` 与 `src/utils/album-scanner.ts` 处理。
- 设有 `password` 的相册必须同时验证详情页和受保护照片，不能把密码或明文受保护清单写入公开文章或日志。

示例结构：

```text
public/images/albums/summer/
├── info.json
├── cover.webp
├── beach_海边.webp
└── sunset_晚霞.webp
```

相册变更后运行 `npx.cmd astro check`、`pnpm.cmd check:manifest`，以及 `npx.cmd playwright test tests/site/albums.spec.ts tests/site/post-encryption.spec.ts`。

## 必读文档

- `src/config/README.md` — config/data 归属和配置导入规则
- `src/types/album.ts`、`src/utils/album-scanner.ts` — 相册实际 schema 与扫描规则
- `src/data/` — 各数据页内容实体
- `src/config/` — 各数据页行为配置
- `src/pages/_AGENTS.md` — 相册保护与 SSR 约束

## npm 包模式数据路径

运行 `npx.cmd shirones init` 后，用户数据生成在 `shirones/config/data/` 和 `shirones/content/`，相册及其他静态媒体仍位于用户项目的 `public/`。不要编辑 `node_modules/shirones` 中的包文件；构建期消费数据路径时遵循 `docs/npm-package-mode.md` 和 `docs/packaging-contract.md`。
