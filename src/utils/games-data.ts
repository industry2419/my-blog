import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import type {
	GameCredential,
	GameSnapshotCredential,
	ResolvedGamesOptions,
	SteamGameEntry,
	SteamLibrary,
} from "@/types/gamesConfig";
import { parseGameCovers } from "./games/covers.ts";
import {
	hasAnyMetric,
	mergeGameCredentials,
	parseGamesSnapshot,
} from "./games/normalize.ts";
import {
	deriveSteamStatus,
	mergeSteamLibraries,
	parseSteamLocalSnapshot,
	parseSteamSnapshot,
} from "./games/steam.ts";

/** 快照目录解析：相对路径以项目根（构建/脚本运行目录）为基准。 */
function resolveSnapshotDirectory(options: ResolvedGamesOptions): string {
	return isAbsolute(options.snapshot.directory)
		? options.snapshot.directory
		: resolve(process.cwd(), options.snapshot.directory);
}

/**
 * 构建期读取游戏资历快照。
 *
 * 契约：只读本地 JSON，不发起任何网络请求；`source.kind` 非 snapshot 时
 * 直接返回空数组，保证关闭功能时零文件读取、零额外负担。
 * 文件缺失、损坏、schema 不匹配时静默降级（仅控制台提示）。
 */
export function getGamesCredentials(
	options: ResolvedGamesOptions,
): GameSnapshotCredential[] {
	if (options.source.kind !== "snapshot") return [];

	const filename = options.source.file;
	if (!filename) return [];

	const directory = resolveSnapshotDirectory(options);
	const filePath = join(directory, filename);

	if (!existsSync(filePath)) {
		console.warn(
			`[games] ⚠ Credential snapshot not found: ${filePath}. Falling back to "${options.fallback}".`,
		);
		return [];
	}

	try {
		const content = readFileSync(filePath, "utf-8");
		const snapshot = parseGamesSnapshot(content);
		if (!snapshot) {
			console.warn(
				`[games] ⚠ Invalid credential snapshot schema: ${filePath}. Falling back to "${options.fallback}".`,
			);
			return [];
		}

		if (snapshot.fetchedAt) {
			const fetchedTime = new Date(snapshot.fetchedAt).getTime();
			if (!Number.isNaN(fetchedTime)) {
				const ageDays = (Date.now() - fetchedTime) / (1000 * 60 * 60 * 24);
				if (ageDays > options.snapshot.staleAfterDays) {
					console.warn(
						`[games] ⚠ Credential snapshot "${filename}" is stale (${Math.floor(ageDays)} days old, fetched at ${snapshot.fetchedAt}). Run "pnpm games:sync" to refresh.`,
					);
				}
			}
		}

		return snapshot.credentials;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(
			`[games] ⚠ Failed to read credential snapshot (${message}). Falling back to "${options.fallback}".`,
		);
		return [];
	}
}

/**
 * 将快照资历合并到游戏条目上。
 *
 * - `fallback.kind === "empty"`：不采用任何资历数据（连手填值也不展示）；
 * - 其他情况：快照命中优先，未命中或指标为空时保留 `GameItem.credential`。
 */
export function applyGameCredentials<
	T extends { id: string; credential?: GameCredential },
>(items: readonly T[], options: ResolvedGamesOptions): T[] {
	if (options.fallback === "empty") {
		return items.map((item) =>
			item.credential ? { ...item, credential: undefined } : item,
		);
	}

	const credentials = getGamesCredentials(options);
	if (credentials.length === 0) {
		return [...items];
	}

	return mergeGameCredentials(items, credentials).map((item) =>
		hasAnyMetric(item.credential) ? item : { ...item, credential: undefined },
	);
}

/**
 * 构建期读取版本封面快照。
 *
 * 契约与资历快照一致：只读本地 JSON，不发起网络请求；文件缺失或损坏时
 * 静默返回空映射，页面继续使用内容仓手填的 cover。
 */
export function getGameCovers(
	options: ResolvedGamesOptions,
): Record<string, string> {
	const filePath = join(resolveSnapshotDirectory(options), "covers.json");
	if (!existsSync(filePath)) return {};

	try {
		const snapshot = parseGameCovers(readFileSync(filePath, "utf-8"));
		return snapshot?.covers ?? {};
	} catch {
		return {};
	}
}

/**
 * 将 `games:covers` 同步的版本封面合并到游戏条目上。
 *
 * 快照命中优先；未命中（新增游戏、同步失败）时保留内容仓里的手填封面。
 */
export function applyGameCovers<T extends { id: string; cover?: string }>(
	items: readonly T[],
	options: ResolvedGamesOptions,
): T[] {
	const covers = getGameCovers(options);
	if (Object.keys(covers).length === 0) return [...items];

	return items.map((item) => {
		const cover = covers[item.id];
		return cover ? { ...item, cover } : item;
	});
}

/**
 * 读取一个 Steam 快照文件；缺失或损坏时返回 null（不抛错）。
 */
function readSteamSnapshotFile(
	filePath: string,
	provider: "steam" | "steam-local",
): { fetchedAt: string; games: SteamGameEntry[] } | null {
	if (!existsSync(filePath)) return null;

	try {
		const content = readFileSync(filePath, "utf-8");
		const snapshot =
			provider === "steam"
				? parseSteamSnapshot(content)
				: parseSteamLocalSnapshot(content);

		if (!snapshot) {
			console.warn(
				`[games] ⚠ Invalid ${provider} snapshot schema: ${filePath}. Ignored.`,
			);
			return null;
		}

		return { fetchedAt: snapshot.fetchedAt, games: snapshot.games };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(
			`[games] ⚠ Failed to read ${provider} snapshot (${message}). Ignored.`,
		);
		return null;
	}
}

/**
 * 构建期读取 Steam 游戏库快照，并合并本地补录。
 *
 * 契约与资历/封面快照一致：只读本地 JSON，不发起任何网络请求。
 * 在线快照缺失或关闭时返回空库；本地补录仅在 `localPlaytime` 开启时读取，
 * 同一 AppID 以在线记录为准。`fetchedAt` 取两个快照中较早的一个，
 * 避免任一来源过期时仍展示「近两周」。
 */
export function getSteamLibrary(options: ResolvedGamesOptions): SteamLibrary {
	if (!options.steam.enable) return { fetchedAt: "", games: [] };

	const directory = resolveSnapshotDirectory(options);
	const owned = readSteamSnapshotFile(
		join(directory, options.steam.file),
		"steam",
	);
	if (!owned) return { fetchedAt: "", games: [] };

	const local = options.steam.localPlaytime
		? readSteamSnapshotFile(
				join(directory, options.steam.localFile),
				"steam-local",
			)
		: null;

	const games = mergeSteamLibraries(
		owned.games,
		local?.games ?? [],
		options.steam.topGames,
	).map((game) => ({ ...game, status: deriveSteamStatus(game) }));
	const timestamps = [owned.fetchedAt, local?.fetchedAt].filter(
		(value): value is string => Boolean(value),
	);
	const fetchedAt = timestamps.sort()[0] ?? owned.fetchedAt;

	if (fetchedAt) {
		const fetchedTime = new Date(fetchedAt).getTime();
		if (!Number.isNaN(fetchedTime)) {
			const ageDays = (Date.now() - fetchedTime) / (1000 * 60 * 60 * 24);
			if (ageDays > options.snapshot.staleAfterDays) {
				console.warn(
					`[games] ⚠ Steam snapshot is stale (${Math.floor(ageDays)} days old, fetched at ${fetchedAt}). Run "pnpm games:steam" to refresh.`,
				);
			}
		}
	}

	return { fetchedAt, games };
}
