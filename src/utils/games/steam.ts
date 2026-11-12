import type {
	SteamGameEntry,
	SteamLocalSnapshot,
	SteamSnapshot,
} from "../../types/gamesConfig.ts";

/**
 * Steam 游戏库快照的字段白名单清洗与排序（同步脚本与构建期共用）。
 *
 * 契约：不访问网络、不读写文件；快照被手改或字段漂移时逐条丢弃非法条目，
 * 没有任何有效游戏时返回 null，调用方据此隐藏 Steam 区块。
 */

/** 站内封面只接受脚本生成的固定路径，避免快照指向任意文件。 */
const SAFE_STEAM_COVER = /^\/games-art\/steam\/\d{1,10}\.webp$/;

/** 单次快照最多处理的条目数（防止异常大文件拖慢构建）。 */
const MAX_GAMES = 200;

function toInteger(
	value: unknown,
	min: number,
	max: number,
): number | undefined {
	const numeric =
		typeof value === "number"
			? value
			: typeof value === "string" && value.trim() !== ""
				? Number(value)
				: Number.NaN;
	if (!Number.isFinite(numeric)) return undefined;
	const rounded = Math.round(numeric);
	if (rounded < min || rounded > max) return undefined;
	return rounded;
}

function toText(value: unknown, maxLength: number): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed.slice(0, maxLength);
}

/** 清洗单款游戏；缺少 AppID、名称或时长时返回 null。 */
export function normalizeSteamGame(raw: unknown): SteamGameEntry | null {
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
	const source = raw as Record<string, unknown>;

	const appId = toInteger(source.appId, 1, 2_147_483_647);
	const name = toText(source.name, 120);
	const minutes = toInteger(source.minutes, 0, 100_000_000);
	if (appId === undefined || !name || minutes === undefined) return null;

	const entry: SteamGameEntry = { appId, name, minutes };

	const recentMinutes = toInteger(source.recentMinutes, 0, 100_000_000);
	if (recentMinutes !== undefined && recentMinutes > 0) {
		entry.recentMinutes = recentMinutes;
	}

	if (typeof source.cover === "string" && SAFE_STEAM_COVER.test(source.cover)) {
		entry.cover = source.cover;
	}

	const achievements = source.achievements;
	if (achievements && typeof achievements === "object") {
		const record = achievements as Record<string, unknown>;
		const done = toInteger(record.done, 0, 1_000_000);
		const total = toInteger(record.total, 1, 1_000_000);
		if (done !== undefined && total !== undefined && done <= total) {
			entry.achievements = { done, total };
		}
	}

	return entry;
}

/** 按总游玩时长降序排列；时长相同按名称稳定排序。 */
export function sortSteamGames(
	games: readonly SteamGameEntry[],
): SteamGameEntry[] {
	return [...games].sort(
		(left, right) =>
			right.minutes - left.minutes || left.name.localeCompare(right.name),
	);
}

/**
 * 合并在线库与本地补录：同一 AppID 以在线记录为准，再按总时长取前 N 款。
 *
 * 本地补录用于家庭共享游戏——它们不在 GetOwnedGames 中，但客户端
 * `localconfig.vdf` 记录了本机游玩时长。
 */
export function mergeSteamLibraries(
	owned: readonly SteamGameEntry[],
	local: readonly SteamGameEntry[],
	limit: number,
): SteamGameEntry[] {
	const seen = new Set<number>();
	const merged: SteamGameEntry[] = [];

	for (const game of [...owned, ...local]) {
		if (seen.has(game.appId)) continue;
		seen.add(game.appId);
		merged.push(game);
	}

	const safeLimit = Number.isFinite(limit)
		? Math.min(MAX_GAMES, Math.max(1, Math.floor(limit)))
		: 12;

	return sortSteamGames(merged).slice(0, safeLimit);
}

/** 本地 `localconfig.vdf` 中的一条已游玩记录（时长单位：分钟）。 */
export interface SteamLocalPlayedApp {
	appId: number;
	minutes: number;
	recentMinutes?: number;
	lastPlayed?: number;
}

/**
 * 从 `localconfig.vdf` 中提取 `apps` 段里有时长记录的游戏。
 *
 * 只做只读文本解析：不评估 VDF 的其他字段，也不依赖第三方解析库。
 * Steam 客户端会把家庭共享游戏的时长写在这里（单位分钟），而在线的
 * GetOwnedGames 不会返回这些 AppID。
 */
export function parseSteamLocalConfig(content: string): SteamLocalPlayedApp[] {
	const lines = content.split(/\r?\n/);
	const result: SteamLocalPlayedApp[] = [];

	let insideApps = false;
	let depth = 0;
	let current: SteamLocalPlayedApp | null = null;

	const flush = () => {
		if (current && current.minutes > 0) result.push(current);
		current = null;
	};

	for (const line of lines) {
		const trimmed = line.trim();

		if (!insideApps) {
			if (trimmed === '"apps"') insideApps = true;
			continue;
		}

		if (trimmed === "{") {
			depth += 1;
			continue;
		}

		if (trimmed === "}") {
			depth -= 1;
			if (depth === 1) flush();
			if (depth <= 0) break;
			continue;
		}

		if (depth === 1) {
			const appIdMatch = trimmed.match(/^"(\d+)"$/);
			if (appIdMatch) {
				flush();
				current = { appId: Number(appIdMatch[1]), minutes: 0 };
			}
			continue;
		}

		if (depth !== 2 || !current) continue;

		const pair = trimmed.match(/^"([^"]+)"\s+"([^"]*)"$/);
		if (!pair) continue;

		const [, key, value] = pair;
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) continue;

		if (key === "Playtime") current.minutes = numeric;
		else if (key === "Playtime2wks") current.recentMinutes = numeric;
		else if (key === "LastPlayed") current.lastPlayed = numeric;
	}

	return result;
}

type ParsedSteamSnapshot = {
	fetchedAt: string;
	games: SteamGameEntry[];
};

function parseSnapshot(
	content: string,
	provider: SteamSnapshot["provider"] | SteamLocalSnapshot["provider"],
): ParsedSteamSnapshot | null {
	let record: unknown;
	try {
		record = JSON.parse(content);
	} catch {
		return null;
	}

	if (!record || typeof record !== "object" || Array.isArray(record)) {
		return null;
	}

	const snapshot = record as Record<string, unknown>;
	if (snapshot.schemaVersion !== 1 || snapshot.provider !== provider) {
		return null;
	}
	if (!Array.isArray(snapshot.games)) return null;

	const games = snapshot.games
		.slice(0, MAX_GAMES)
		.map(normalizeSteamGame)
		.filter((entry): entry is SteamGameEntry => Boolean(entry));

	if (games.length === 0) return null;

	return {
		fetchedAt: typeof snapshot.fetchedAt === "string" ? snapshot.fetchedAt : "",
		games: sortSteamGames(games),
	};
}

/**
 * 解析 `pnpm games:steam` 生成的在线快照。
 *
 * 版本或 provider 不匹配、结构缺失、没有有效条目时返回 null。
 */
export function parseSteamSnapshot(content: string): SteamSnapshot | null {
	const parsed = parseSnapshot(content, "steam");
	if (!parsed) return null;
	return { schemaVersion: 1, provider: "steam", ...parsed };
}

/**
 * 解析本地补录快照（家庭共享游戏）。
 *
 * 与在线快照同样的白名单校验；没有有效条目时返回 null，调用方视为无补录。
 */
export function parseSteamLocalSnapshot(
	content: string,
): SteamLocalSnapshot | null {
	const parsed = parseSnapshot(content, "steam-local");
	if (!parsed) return null;
	return { schemaVersion: 1, provider: "steam-local", ...parsed };
}
