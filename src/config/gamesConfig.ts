import type {
	GamesConfig,
	GamesFallbackKind,
	ResolvedGamesOptions,
} from "@/types/gamesConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 游戏展示页行为与展示配置。
 *
 * 遵循「配置管行为，数据管内容」原则：
 * - enable：页面总开关；false 时导航入口同步隐藏，访问 /games/ 跳转 404；
 * - categories：游戏分类清单（数组顺序即页面顶部 Chips 顺序；
 *   没有任何条目的分类会自动隐藏，因此可放心保留暂时用不到的分类）；
 * - disabledIds：可选被禁用的游戏 ID 列表；
 * - source / fallback / providers / snapshot：可选的资历快照同步（默认 local，零外部依赖）。
 *
 * 注：游戏的具体清单数据（游戏名、开发商、封面、评分、时长、简评等）请在 `src/data/games.ts` 中维护。
 */
export const gamesConfig: GamesConfig = withUserConfig("games", {
	enable: true,
	title: "$t:games",
	description: "$t:gamesBanner",
	categories: [
		{
			key: "open-world",
			label: "Open World",
			icon: "material-symbols:explore-outline-rounded",
			description: "Open-world adventures",
		},
		{
			key: "sandbox",
			label: "Sandbox",
			icon: "material-symbols:widgets-rounded",
			description: "Building, crafting & creative worlds",
		},
		{
			key: "rpg",
			label: "RPG",
			icon: "material-symbols:shield-outline-rounded",
			description: "Role-playing stories & builds",
		},
		{
			key: "action",
			label: "Action",
			icon: "material-symbols:swords-outline-rounded",
			description: "Action, fighting & shooters",
		},
		{
			key: "casual",
			label: "Casual",
			icon: "material-symbols:extension-outline-rounded",
			description: "Cozy, casual & party games",
		},
	],
	// disabledIds: [],
	source: {
		kind: "local",
		provider: "enka",
		fetchOnDev: false,
	},
	fallback: {
		kind: "local",
	},
	providers: {
		enka: {
			enable: false,
			games: [],
		},
		// Steam 游戏库：默认关闭；启用前在 .env 配置 STEAM_API_KEY 与 STEAM_ID，
		// 并运行 `pnpm games:steam` 生成 src/data/games-snapshots/steam.json。
		steam: {
			enable: true,
			topGames: 12,
			downloadCovers: true,
			// 家庭共享游戏不在 GetOwnedGames 中，开启后读取本机
			// userdata/<id>/config/localconfig.vdf 补录时长。
			localPlaytime: true,
		},
	},
	snapshot: {
		directory: "src/data/games-snapshots",
		staleAfterDays: 30,
		keepLastValid: true,
	},
});

const SAFE_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.json$/;

/**
 * 校验并解析游戏页配置，返回只读的标准选项。
 *
 * 与番剧解析的差异：游戏资历不支持开发期实时拉取（`fetchOnDev` 恒为 false），
 * 快照只由 `pnpm games:sync` 写入，避免开发服务器意外发起第三方请求。
 */
export function resolveGamesOptions(config: GamesConfig): ResolvedGamesOptions {
	const enable = Boolean(config.enable);
	const fallback: GamesFallbackKind =
		config.fallback?.kind === "empty" ? "empty" : "local";

	const directory =
		typeof config.snapshot?.directory === "string" &&
		config.snapshot.directory.trim() &&
		!config.snapshot.directory.includes("..")
			? config.snapshot.directory.trim().replace(/[\\/]+$/, "")
			: "src/data/games-snapshots";

	const staleAfterDays =
		typeof config.snapshot?.staleAfterDays === "number" &&
		Number.isFinite(config.snapshot.staleAfterDays) &&
		config.snapshot.staleAfterDays > 0
			? Math.floor(config.snapshot.staleAfterDays)
			: 30;

	const keepLastValid = config.snapshot?.keepLastValid ?? true;

	const steamConfig = config.providers?.steam;
	const steamTopGames =
		typeof steamConfig?.topGames === "number" &&
		Number.isFinite(steamConfig.topGames)
			? Math.min(200, Math.max(1, Math.floor(steamConfig.topGames)))
			: 12;

	let kind: ResolvedGamesOptions["source"]["kind"] = "local";
	let provider: "enka" | undefined;
	let file: string | undefined;

	if (config.source?.kind === "snapshot") {
		if (config.source.provider === "enka") {
			provider = "enka";
		}

		const rawFile = config.source.file?.trim();
		if (rawFile && SAFE_FILENAME_PATTERN.test(rawFile)) {
			file = rawFile;
		} else if (provider) {
			file = `${provider}.json`;
		}

		if (file) {
			kind = "snapshot";
		}
	}

	return Object.freeze({
		enable,
		source: Object.freeze({
			kind,
			...(provider ? { provider } : {}),
			...(file ? { file } : {}),
			fetchOnDev: false,
		}),
		fallback,
		snapshot: Object.freeze({
			directory,
			staleAfterDays,
			keepLastValid,
		}),
		steam: Object.freeze({
			enable: steamConfig?.enable === true,
			file: "steam.json",
			localFile: "steam-local.json",
			localPlaytime: steamConfig?.localPlaytime === true,
			topGames: steamTopGames,
		}),
	});
}

export const resolvedGamesOptions: ResolvedGamesOptions =
	resolveGamesOptions(gamesConfig);
