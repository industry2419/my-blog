/**
 * 游戏展示页配置类型定义。
 * 遵循 Shirone 配置契约：配置放在 src/config/gamesConfig.ts，
 * 数据放在 src/data/games.ts，类型放在本文件；页面总开关关闭时 /games/ 重定向 404 且导航隐藏。
 *
 * 与设备/番剧页的区别：游戏封面是横屏的（胶囊图），卡片以横向封面为主视觉，
 * 因此 GameItem 的媒体字段是 cover（cover 填充的宽幅 banner）而非方图。
 */

import type { PageMeta } from "./pageMeta.ts";

/** 游玩状态 */
export type GameStatus = "playing" | "completed" | "backlog" | "wishlist";

/** 游戏资历数据来源 */
export type GamesSourceKind = "local" | "snapshot";

/** 资历数据降级策略 */
export type GamesFallbackKind = "local" | "empty";

/** Enka.Network 支持的米哈游游戏标识 */
export type GamesProviderKey = "genshin" | "starrail" | "zenless";

/**
 * 单款游戏的账号映射（用于同步脚本抓取，uid 不进入 UI）。
 */
export interface GamesAccountEntry {
	/** 对应 GameItem.id */
	gameId: string;
	/** 游戏标识 */
	provider: GamesProviderKey;
	/** 游戏内 UID */
	uid: string;
}

/**
 * 外部同步的资历指标。所有字段可选：不同游戏能提供的维度不同，
 * 只渲染存在的指标，缺失时不占位。
 */
export interface GameCredential {
	/** 账号等级（冒险等阶 / 开拓等级 / 绳网等级） */
	level?: number;
	/** 等级本地化标签（如「冒险等阶」），缺省用 i18n 文案 */
	levelLabel?: string;
	/** 成就完成数（部分接口不提供总数，此时只显示完成数） */
	achievements?: { done: number; total?: number };
	/** 探索进度（可多项） */
	exploration?: { label: string; percent: number }[];
	/** 深渊 / 高难战绩 */
	challenge?: {
		label: string;
		value: number;
		max?: number;
		unit?: string;
		season?: string;
	};
	/** 其余可证明资历的指标 */
	extra?: { key: string; label?: string; value: number | string }[];
}

/** Enka.Network provider 配置（公开接口，无需凭据） */
export interface EnkaProviderConfig {
	/** 是否启用 Enka 同步 */
	enable: boolean;
	/** 需要同步的账号列表 */
	games: GamesAccountEntry[];
	/** 可选请求调优 */
	request?: {
		minDelayMs?: number;
		timeoutMs?: number;
	};
}

/**
 * Steam Web API provider 配置（构建期同步，运行时零请求）。
 *
 * 凭据不入库：API Key 与 SteamID64 只从环境变量读取，快照里不保存 API Key。
 * 「游戏详情」必须设为公开，否则 GetOwnedGames 只会返回空列表。
 */
export interface SteamProviderConfig {
	/** 是否启用 Steam 游戏库同步（默认 false）。 */
	enable: boolean;
	/** API Key 所在环境变量名（默认 STEAM_API_KEY）。 */
	apiKeyEnv?: string;
	/** SteamID64 所在环境变量名（默认 STEAM_ID）。 */
	steamIdEnv?: string;
	/** 同步游玩时长最多的前 N 款游戏（1–100，默认 12）。 */
	topGames?: number;
	/** 为前 N 款游戏拉取成就完成度（0 关闭，默认与 `topGames` 相同）。 */
	achievementLimit?: number;
	/** 是否下载商店头图作为站内封面（默认 true）。 */
	downloadCovers?: boolean;
	/**
	 * 是否合并 Steam 客户端本地游玩记录（默认 false）。
	 *
	 * 家庭共享游戏不会出现在 GetOwnedGames 中，但其时长记录在
	 * `userdata/<id>/config/localconfig.vdf`；启用后同步脚本会读取该文件，
	 * 将额外游戏写入 `steam-local.json`，构建期与在线库合并展示。
	 */
	localPlaytime?: boolean;
	/** 可选请求调优。 */
	request?: {
		minDelayMs?: number;
		timeoutMs?: number;
	};
}

/** 快照存储与健康度策略 */
export interface GamesSnapshotConfig {
	/** 快照目录（相对项目根，默认 src/data/games-snapshots） */
	directory: string;
	/** 过期告警天数（仅日志提示，默认 30） */
	staleAfterDays?: number;
	/** 同步失败时是否保留上一次有效快照（默认 true） */
	keepLastValid: boolean;
}

/** 游戏分类定义（数组顺序即筛选 Chips 渲染顺序） */
export interface GameCategory {
	/** 稳定标识，供游戏引用与筛选。 */
	key: string;
	/** 用户可编辑的分类名称。 */
	label: string;
	/** Iconify 图标名（筛选 Chip 前置图标）。 */
	icon?: string;
	/** 可选的分类说明。 */
	description?: string;
}

/** 单个游戏条目 */
export interface GameItem {
	/** 可选独立开关；关闭后不参与渲染与计数（优先使用 config.disabledIds）。 */
	enable?: boolean;
	/** 稳定标识（URL 片段 / 测试选择器）。 */
	id: string;
	/** 游戏名称。 */
	name: string;
	/** 开发商/工作室（如 miHoYo, FromSoftware）。 */
	developer: string;
	/** 所属分类（对应 GameCategory.key）。 */
	category: string;
	/** 游玩状态。 */
	status: GameStatus;
	/** 横屏封面图（站内绝对路径，建议 16:9 或更宽的本地 WebP/AVIF）。 */
	cover?: string;
	/** 无封面时使用的 Iconify 图标。 */
	icon?: string;
	/** 评分（0–5，支持 0.5 步进）。 */
	rating?: number;
	/** 已游玩时长（小时）。 */
	hours?: number;
	/** 平台（如 PC / PlayStation / Switch / Mobile）。 */
	platform?: string;
	/** 发行年份（自由格式，如 "2024"）。 */
	year?: string;
	/** 类型标签（渲染为卡片上的 chips）。 */
	tags?: string[];
	/** 游戏简评/感受。 */
	description: string;
	/** 商店页、官网或评测链接。 */
	link?: string;
	/** 特别推荐标记（渲染 Featured 徽章）。 */
	featured?: boolean;
	/** 手填资历数据（快照缺失或未启用同步时的兜底）。 */
	credential?: GameCredential;
}

/**
 * 快照中的单条资历记录：在通用指标之外带上匹配与审计字段。
 */
export interface GameSnapshotCredential extends GameCredential {
	/** 对应 GameItem.id */
	gameId: string;
	/** 游戏标识 */
	provider: GamesProviderKey;
	/** 游戏内 UID（仅审计，不渲染） */
	uid: string;
}

/**
 * 版本化快照封套。
 */
export interface GamesSnapshot {
	schemaVersion: 1;
	provider: "enka";
	fetchedAt: string;
	accountRef: string;
	credentials: GameSnapshotCredential[];
}

/**
 * 版本化封面快照封套（由 `pnpm games:covers` 生成）。
 *
 * `covers` 的键为 GameItem.id，值为 `/games-art/<id>.webp` 形式的站内路径。
 * 快照存在时优先于内容仓手填的 cover，缺失或损坏时静默回退。
 */
export interface GameCoversSnapshot {
	schemaVersion: 1;
	fetchedAt: string;
	covers: Record<string, string>;
}

/** Steam 游戏库中的单款游戏（由 `pnpm games:steam` 写入快照）。 */
export interface SteamGameEntry {
	/** Steam AppID。 */
	appId: number;
	/** 游戏名称。 */
	name: string;
	/** 总游玩时长（分钟）。 */
	minutes: number;
	/** 最近两周游玩时长（分钟），无记录时缺省。 */
	recentMinutes?: number;
	/** 站内封面路径（`/games-art/steam/<appId>.webp`），下载失败时缺省。 */
	cover?: string;
	/** 成就完成度；游戏未提供成就统计时缺省。 */
	achievements?: { done: number; total: number };
}

/** 版本化 Steam 游戏库快照封套（不包含 API Key）。 */
export interface SteamSnapshot {
	schemaVersion: 1;
	provider: "steam";
	fetchedAt: string;
	games: SteamGameEntry[];
}

/**
 * 本地补录快照：只包含 GetOwnedGames 未返回、但客户端有游玩记录的游戏。
 *
 * 由 `pnpm games:steam` 在配置开启 `localPlaytime` 时生成；来源是
 * `userdata/<id>/config/localconfig.vdf`，因此合入游戏拥有者之外的时长
 * 只代表本机记录，不应写回在线快照。
 */
export interface SteamLocalSnapshot {
	schemaVersion: 1;
	provider: "steam-local";
	fetchedAt: string;
	games: SteamGameEntry[];
}

/** 构建期读取并排序后的 Steam 游戏库。 */
export interface SteamLibrary {
	fetchedAt: string;
	games: SteamGameEntry[];
}

/**
 * 经解析与校验后的游戏页运行选项。
 */
export interface ResolvedGamesOptions {
	enable: boolean;
	source: {
		kind: GamesSourceKind;
		provider?: "enka";
		file?: string;
		fetchOnDev?: boolean;
	};
	fallback: GamesFallbackKind;
	snapshot: {
		directory: string;
		staleAfterDays: number;
		keepLastValid: boolean;
	};
	/** Steam 游戏库构建期读取选项（关闭时零文件读取）。 */
	steam: {
		enable: boolean;
		file: string;
		/** 本地补录快照文件名（仅 localPlaytime 开启时读取）。 */
		localFile: string;
		/** 是否合并客户端本地游玩记录。 */
		localPlaytime: boolean;
		/** 合并后展示的最大条目数。 */
		topGames: number;
	};
}

/** 游戏页全局配置（行为层） */
export interface GamesConfig extends PageMeta {
	/** 页面总开关；关闭后隐藏导航入口并将 /games/ 重定向到 404。 */
	enable: boolean;
	/** 游戏分类列表（决定 Chips 渲染顺序）。 */
	categories: GameCategory[];
	/** 可选被禁用的游戏 ID 列表。 */
	disabledIds?: string[];
	/** 兼容通用 disabledKeys 别名。 */
	disabledKeys?: string[];
	/** 可选自定义数据（向后兼容；默认读取 src/data/games.ts）。 */
	items?: GameItem[];
	/** 资历数据来源（缺省 local，零外部依赖）。 */
	source?: {
		kind: GamesSourceKind;
		provider?: "enka";
		/** 快照文件名（限定在 snapshot.directory 内）。 */
		file?: string;
		fetchOnDev?: boolean;
	};
	/** 快照不可用时的降级策略。 */
	fallback?: {
		kind: GamesFallbackKind;
	};
	/** 外部数据提供方。 */
	providers?: {
		enka?: EnkaProviderConfig;
		steam?: SteamProviderConfig;
	};
	/** 快照存储策略。 */
	snapshot?: GamesSnapshotConfig;
}
