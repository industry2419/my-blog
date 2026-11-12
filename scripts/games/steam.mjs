import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { setGlobalProxyFromEnv } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
	gamesConfig,
	resolveGamesOptions,
} from "../../src/config/gamesConfig.ts";
import {
	normalizeSteamGame,
	parseSteamLocalConfig,
	sortSteamGames,
} from "../../src/utils/games/steam.ts";
import { loadEnvFile } from "../anime/load-env.mjs";
import { commitSnapshot, isSnapshotStale } from "../anime/snapshot-store.mjs";

/**
 * 同步 Steam 游戏库：总游玩时长、最近两周时长与成就完成度。
 *
 * 数据源为 Steam Web API（构建期执行，官方桌面端运行时不发任何请求）：
 * - GetOwnedGames：已拥有游戏与游玩时长；
 * - GetPlayerAchievements：前 N 款游戏的成就完成数；
 * - Steam CDN 封面：优先商店头图，缺失时回退到库内主视觉（library_hero）。
 *
 * 凭据只从环境变量读取，永不写入快照；API Key 与 SteamID64 的变量名可在
 * gamesConfig.providers.steam 中覆盖。同步失败时保留上一次有效快照。
 */

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

const ENDPOINTS = {
	ownedGames: "https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/",
	achievements:
		"https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/",
	appList: "https://api.steampowered.com/IStoreService/GetAppList/v1/",
	// 新上架/未公开商店页的游戏可能只有库内美术资源，头图 CDN 返回 404。
	coverCandidates: (appId) => [
		`https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
		`https://shared.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
		`https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_hero.jpg`,
	],
};

const USER_AGENT = "Shirone-Games-Sync/1.0";
const SNAPSHOT_FILENAME = "steam.json";
const LOCAL_SNAPSHOT_FILENAME = "steam-local.json";
const APP_NAME_CACHE = join(
	projectRoot,
	"node_modules",
	".cache",
	"shirone-steam-appnames.json",
);
const STEAM_ID_BASE = 76561197960265728n;
const COVER_WIDTH = 640;
const WEBP_QUALITY = 82;
const MAX_GAMES = 100;
const DEFAULT_TOP_GAMES = 12;

function clampInt(value, fallback, min, max) {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return fallback;
	return Math.min(max, Math.max(min, Math.round(numeric)));
}

function sleep(ms) {
	return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function parseArgs(argv) {
	const result = {
		dryRun: false,
		ifStale: false,
		noAchievements: false,
		noCovers: false,
		force: false,
		limit: undefined,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--dry-run") {
			result.dryRun = true;
		} else if (arg === "--if-stale") {
			result.ifStale = true;
		} else if (arg === "--no-achievements") {
			result.noAchievements = true;
		} else if (arg === "--no-covers") {
			result.noCovers = true;
		} else if (arg === "--force") {
			result.force = true;
		} else if (arg === "--limit") {
			const value = argv[index + 1];
			if (value && !value.startsWith("--")) {
				result.limit = value;
				index += 1;
			}
		} else if (arg.startsWith("--limit=")) {
			result.limit = arg.slice("--limit=".length);
		}
	}

	return result;
}

function resolveSnapshotDirectory() {
	const options = resolveGamesOptions(gamesConfig);
	const directory = options.snapshot.directory;
	return directory.startsWith("/") || /^[A-Za-z]:/.test(directory)
		? directory
		: join(projectRoot, directory);
}

function buildUrl(endpoint, params) {
	const url = new URL(endpoint);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, String(value));
	}
	return url;
}

async function fetchJson(url, { timeoutMs }) {
	const response = await fetch(url, {
		headers: {
			Accept: "application/json",
			"User-Agent": USER_AGENT,
		},
		signal: AbortSignal.timeout(timeoutMs),
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}

	return response.json();
}

async function fetchOwnedGames({ apiKey, steamId, timeoutMs }) {
	const url = buildUrl(ENDPOINTS.ownedGames, {
		key: apiKey,
		steamid: steamId,
		include_appinfo: 1,
		include_played_free_games: 1,
		format: "json",
	});

	const payload = await fetchJson(url, { timeoutMs });
	const games = payload?.response?.games;

	if (!Array.isArray(games)) {
		throw new Error(
			"接口未返回游戏列表：请确认 Steam 个人资料与游戏详情已设为公开",
		);
	}

	return games;
}

async function fetchAchievements({ apiKey, steamId, appId, timeoutMs }) {
	const url = buildUrl(ENDPOINTS.achievements, {
		key: apiKey,
		steamid: steamId,
		appid: appId,
		l: "english",
		format: "json",
	});

	const payload = await fetchJson(url, { timeoutMs });
	const stats = payload?.playerstats;

	if (stats?.success !== true || !Array.isArray(stats.achievements)) {
		return null;
	}

	const total = stats.achievements.length;
	if (total === 0) return null;

	const done = stats.achievements.filter(
		(entry) => Number(entry?.achieved) === 1,
	).length;

	return { done, total };
}

async function downloadCover(appId, { timeoutMs }) {
	let lastError;

	for (const url of ENDPOINTS.coverCandidates(appId)) {
		try {
			const response = await fetch(url, {
				headers: {
					Accept: "image/*",
					"User-Agent": USER_AGENT,
				},
				signal: AbortSignal.timeout(timeoutMs),
			});

			if (!response.ok) {
				lastError = new Error(`HTTP ${response.status}`);
				continue;
			}

			const buffer = Buffer.from(await response.arrayBuffer());
			const { data } = await sharp(buffer)
				.resize({ width: COVER_WIDTH, withoutEnlargement: true })
				.webp({ quality: WEBP_QUALITY })
				.toBuffer({ resolveWithObject: true });

			return data;
		} catch (error) {
			lastError = error;
		}
	}

	throw lastError ?? new Error("没有可用的封面资源");
}

/**
 * 定位 Steam 安装根目录：环境变量 → Windows 注册表 → 由 localconfig 路径反推。
 */
function resolveSteamRoot(localConfigPath) {
	const configured = process.env.STEAM_ROOT?.trim();
	if (configured) return configured;

	if (process.platform === "win32") {
		try {
			const output = execFileSync(
				"reg",
				["query", "HKCU\\Software\\Valve\\Steam", "/v", "SteamPath"],
				{ encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
			);
			const match = output.match(/SteamPath\s+REG_SZ\s+(.+)/i);
			if (match) return match[1].trim().replace(/\//g, "\\");
		} catch {
			// 注册表不可用时继续尝试其他来源
		}
	}

	if (localConfigPath) return resolve(localConfigPath, "../../../..");

	const home = process.env.HOME || process.env.USERPROFILE;
	const candidates = home
		? [join(home, ".steam", "steam"), join(home, ".local", "share", "Steam")]
		: [];
	return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/**
 * 解析本机 `localconfig.vdf` 路径；SteamID64 与 32 位账号 ID 直接换算。
 */
function resolveLocalConfigPath(steamId) {
	const configured = process.env.STEAM_LOCALCONFIG?.trim();
	if (configured) return resolve(configured);

	const steamRoot = resolveSteamRoot();
	if (!steamRoot) return null;

	let accountId;
	try {
		const numericId = BigInt(steamId);
		if (numericId <= STEAM_ID_BASE) return null;
		accountId = (numericId - STEAM_ID_BASE).toString();
	} catch {
		return null;
	}

	return join(steamRoot, "userdata", accountId, "config", "localconfig.vdf");
}

/** 读取 `libraryfolders.vdf`，返回 Steam 根目录与所有游戏库目录。 */
function resolveLibraryRoots(steamRoot) {
	if (!steamRoot) return [];

	const roots = new Set([steamRoot]);
	const librariesFile = join(steamRoot, "steamapps", "libraryfolders.vdf");

	if (existsSync(librariesFile)) {
		try {
			const content = readFileSync(librariesFile, "utf8");
			for (const match of content.matchAll(/"path"\s+"((?:[^"\\]|\\.)*)"/g)) {
				roots.add(match[1].replace(/\\\\/g, "\\"));
			}
		} catch {
			// 库配置损坏时至少保留 Steam 根目录
		}
	}

	return [...roots];
}

/**
 * 从各游戏库的 `appmanifest_<id>.acf` 读取名称。
 *
 * 家庭共享游戏通常已安装，本机清单能直接给出名称，避免额外网络请求。
 */
function readManifestNames(steamRoot, targetIds) {
	const names = new Map();
	if (!steamRoot || targetIds.size === 0) return names;

	for (const root of resolveLibraryRoots(steamRoot)) {
		const appsDirectory = join(root, "steamapps");
		if (!existsSync(appsDirectory)) continue;

		let files;
		try {
			files = readdirSync(appsDirectory);
		} catch {
			continue;
		}

		for (const file of files) {
			const match = file.match(/^appmanifest_(\d+)\.acf$/i);
			if (!match) continue;

			const appId = Number(match[1]);
			if (!targetIds.has(appId) || names.has(appId)) continue;

			try {
				const content = readFileSync(join(appsDirectory, file), "utf8");
				const nameMatch = content.match(/"name"\s+"([^"]+)"/);
				if (nameMatch) names.set(appId, nameMatch[1].trim());
			} catch {
				// 单个清单读取失败不影响其他游戏
			}
		}
	}

	return names;
}

function readNameCache() {
	const names = new Map();
	try {
		const parsed = JSON.parse(readFileSync(APP_NAME_CACHE, "utf8"));
		if (parsed && typeof parsed.names === "object" && parsed.names) {
			for (const [key, value] of Object.entries(parsed.names)) {
				const appId = Number(key);
				if (Number.isInteger(appId) && typeof value === "string") {
					names.set(appId, value);
				}
			}
		}
	} catch {
		// 缓存缺失或损坏时重新抓取
	}
	return names;
}

function writeNameCache(names) {
	try {
		mkdirSync(dirname(APP_NAME_CACHE), { recursive: true });
		writeFileSync(
			APP_NAME_CACHE,
			`${JSON.stringify(
				{
					fetchedAt: new Date().toISOString(),
					names: Object.fromEntries(names),
				},
				null,
				2,
			)}\n`,
			"utf8",
		);
	} catch {
		// 缓存写入失败不影响同步
	}
}

/**
 * 用 IStoreService 批量解析 AppID → 名称（分页，命中即停）。
 *
 * 只用于本机已卸载、又没有 appmanifest 的家庭共享游戏；结果缓存在
 * `node_modules/.cache`，不会进入仓库或快照。
 */
async function fetchAppNames(targetIds, { apiKey, timeoutMs }) {
	const names = new Map();
	if (targetIds.size === 0) return names;

	let lastAppId = 0;

	for (let page = 0; page < 10; page += 1) {
		const url = buildUrl(ENDPOINTS.appList, {
			key: apiKey,
			include_games: "true",
			include_dlc: "false",
			include_software: "false",
			include_videos: "false",
			include_hardware: "false",
			max_results: 50000,
			last_appid: lastAppId,
		});

		let payload;
		try {
			payload = await fetchJson(url, { timeoutMs });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn(`[games:steam] 游戏名称解析失败：${message}`);
			break;
		}

		const apps = payload?.response?.apps;
		if (!Array.isArray(apps) || apps.length === 0) break;

		for (const app of apps) {
			const appId = Number(app?.appid);
			if (!targetIds.has(appId)) continue;
			if (typeof app?.name === "string" && app.name.trim()) {
				names.set(appId, app.name.trim());
			}
		}

		if (names.size >= targetIds.size) break;
		if (payload?.response?.have_more_results === false) break;

		const nextAppId = Number(
			payload?.response?.last_appid ?? apps[apps.length - 1]?.appid,
		);
		if (!Number.isFinite(nextAppId) || nextAppId <= lastAppId) break;
		lastAppId = nextAppId;

		await sleep(300);
	}

	return names;
}

/** 为条目补充站内封面；已存在的文件直接复用。 */
async function attachCovers(
	entries,
	{ enabled, force, dryRun, timeoutMs, delayMs },
) {
	if (!enabled || entries.length === 0) return;

	mkdirSync(join(projectRoot, "public", "games-art", "steam"), {
		recursive: true,
	});

	for (const entry of entries) {
		const relativePath = `games-art/steam/${entry.appId}.webp`;
		const outputPath = join(projectRoot, "public", relativePath);
		const publicPath = `/${relativePath}`;

		if (!force && existsSync(outputPath)) {
			entry.cover = publicPath;
			continue;
		}

		if (dryRun) continue;

		try {
			const data = await downloadCover(entry.appId, { timeoutMs });
			writeFileSync(outputPath, data);
			entry.cover = publicPath;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			const cause =
				error instanceof Error && error.cause instanceof Error
					? ` (${error.cause.message})`
					: "";
			console.warn(
				`[games:steam] ${entry.name} 封面下载失败（${message}${cause}），使用渐变占位。`,
			);
		}

		if (delayMs > 0) await sleep(delayMs);
	}
}

/** 为条目补充成就；单款失败不影响整体，本地补录默认静默失败。 */
async function attachAchievements(
	entries,
	{ apiKey, steamId, timeoutMs, delayMs, limit, quiet },
) {
	if (limit <= 0 || entries.length === 0) return;

	const targets = entries.slice(0, limit);

	for (const [index, entry] of targets.entries()) {
		if (entry.hasStats === false) continue;

		try {
			const achievements = await fetchAchievements({
				apiKey,
				steamId,
				appId: entry.appId,
				timeoutMs,
			});
			if (achievements) {
				entry.achievements = achievements;
				console.log(
					`[games:steam] ✓ ${entry.name} 成就 ${achievements.done}/${achievements.total}`,
				);
			}
		} catch (error) {
			if (!quiet) {
				const message = error instanceof Error ? error.message : String(error);
				console.warn(`[games:steam] ✗ ${entry.name} 成就同步失败：${message}`);
			}
		}

		if (delayMs > 0 && index < targets.length - 1) {
			await sleep(delayMs);
		}
	}
}

/**
 * 把接口原始条目转换成快照契约字段；同时留下 hasStats 供成就请求筛选。
 */
function toGameEntry(raw) {
	const appId = Number(raw?.appid);
	const name = typeof raw?.name === "string" ? raw.name.trim() : "";
	const minutes = Number(raw?.playtime_forever);
	const recentMinutes = Number(raw?.playtime_2weeks);

	if (!Number.isInteger(appId) || appId <= 0 || !name) return null;
	if (!Number.isFinite(minutes) || minutes <= 0) return null;

	const entry = {
		appId,
		name,
		minutes: Math.round(minutes),
		hasStats: raw?.has_community_visible_stats === true,
	};

	if (Number.isFinite(recentMinutes) && recentMinutes > 0) {
		entry.recentMinutes = Math.round(recentMinutes);
	}

	return entry;
}

async function main() {
	if (!gamesConfig.enable) {
		console.log("[games:steam] 游戏页已关闭，跳过。");
		return;
	}

	const provider = gamesConfig.providers?.steam;
	if (!provider?.enable) {
		console.log(
			"[games:steam] Steam 同步未启用（gamesConfig.providers.steam.enable = false），跳过。",
		);
		return;
	}

	loadEnvFile();
	// .env 里的代理只在启动后写入 process.env，需显式同步给全局 fetch；
	// 没有配置代理时该调用无副作用，CI 仍直连。
	setGlobalProxyFromEnv();

	const apiKeyEnv = provider.apiKeyEnv?.trim() || "STEAM_API_KEY";
	const steamIdEnv = provider.steamIdEnv?.trim() || "STEAM_ID";
	const apiKey = process.env[apiKeyEnv]?.trim();
	const steamId = process.env[steamIdEnv]?.trim();

	if (!apiKey || !steamId) {
		console.warn(
			`[games:steam] 未配置 ${apiKeyEnv} / ${steamIdEnv}，跳过。在根目录 .env 或 CI Secrets 中填写后重试。`,
		);
		return;
	}

	const args = parseArgs(process.argv.slice(2));
	const options = resolveGamesOptions(gamesConfig);
	const directory = resolveSnapshotDirectory();
	const targetFile = join(directory, SNAPSHOT_FILENAME);

	if (
		args.ifStale &&
		!isSnapshotStale(targetFile, options.snapshot.staleAfterDays)
	) {
		console.log(
			`[games:steam] 快照仍新鲜（< ${options.snapshot.staleAfterDays} 天），按 --if-stale 跳过。`,
		);
		return;
	}

	const timeoutMs = provider.request?.timeoutMs ?? 20000;
	const delayMs = provider.request?.minDelayMs ?? 500;
	const topGames = clampInt(
		args.limit ?? provider.topGames,
		DEFAULT_TOP_GAMES,
		1,
		MAX_GAMES,
	);
	const achievementLimit = args.noAchievements
		? 0
		: clampInt(provider.achievementLimit, topGames, 0, topGames);

	console.log(
		`[games:steam] 开始同步 Steam 游戏库（前 ${topGames} 款，成就前 ${achievementLimit} 款）`,
	);

	let ownedGames;
	try {
		ownedGames = await fetchOwnedGames({ apiKey, steamId, timeoutMs });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[games:steam] 拉取游戏库失败：${message}；保留现有快照。`);
		process.exitCode = 1;
		return;
	}

	const allEntries = ownedGames
		.map(toGameEntry)
		.filter(Boolean)
		.sort((left, right) => right.minutes - left.minutes);

	const selected = allEntries.slice(0, topGames);

	if (selected.length === 0) {
		console.warn(
			"[games:steam] 没有可展示的游戏（可能全部未游玩），保留现有快照。",
		);
		return;
	}

	console.log(
		`[games:steam] 游戏库共 ${allEntries.length} 款，选取前 ${selected.length} 款。`,
	);

	const ownedIds = new Set(allEntries.map((entry) => entry.appId));
	const coversEnabled = provider.downloadCovers !== false && !args.noCovers;

	// 成就与封面：单款失败不影响整体，已存在的封面文件直接复用。
	await attachAchievements(selected, {
		apiKey,
		steamId,
		timeoutMs,
		delayMs,
		limit: achievementLimit,
		quiet: false,
	});
	await attachCovers(selected, {
		enabled: coversEnabled,
		force: args.force,
		dryRun: args.dryRun,
		timeoutMs,
		delayMs,
	});

	const games = sortSteamGames(
		selected
			.map((entry) =>
				normalizeSteamGame({
					appId: entry.appId,
					name: entry.name,
					minutes: entry.minutes,
					recentMinutes: entry.recentMinutes,
					cover: entry.cover,
					achievements: entry.achievements,
				}),
			)
			.filter(Boolean),
	);

	if (games.length === 0) {
		console.warn("[games:steam] 清洗后没有有效条目；保留现有快照。");
		return;
	}

	const snapshot = {
		schemaVersion: 1,
		provider: "steam",
		fetchedAt: new Date().toISOString(),
		games,
	};
	const jsonContent = `${JSON.stringify(snapshot, null, 2)}\n`;

	if (jsonContent.includes(apiKey)) {
		throw new Error("Security Violation: 快照数据中检测到 Steam API Key");
	}

	if (args.dryRun) {
		console.log(jsonContent);
	} else {
		const outcome = commitSnapshot({
			targetFile,
			tempFile: join(directory, `.temp-steam-${Date.now()}.json`),
			jsonContent,
			itemCount: games.length,
			keepLastValid: options.snapshot.keepLastValid,
			itemsKey: "games",
		});

		if (outcome === "kept") {
			console.warn(
				`[games:steam] ⚠ 本次没有有效游戏，保留旧快照：${targetFile}`,
			);
		} else {
			console.log(
				`[games:steam] ✓ 已写入 ${games.length} 款游戏：${targetFile}`,
			);
		}
	}

	let localCount = 0;

	// 家庭共享游戏：GetOwnedGames 不返回，读取客户端本机记录补录。
	if (options.steam.localPlaytime) {
		const localFile = join(directory, LOCAL_SNAPSHOT_FILENAME);
		const localConfigPath = resolveLocalConfigPath(steamId);

		if (!localConfigPath || !existsSync(localConfigPath)) {
			console.warn(
				`[games:steam] 未找到本机 Steam 记录（${localConfigPath ?? "无法定位"}），跳过家庭库补录，保留现有 ${LOCAL_SNAPSHOT_FILENAME}。`,
			);
		} else {
			try {
				const played = parseSteamLocalConfig(
					readFileSync(localConfigPath, "utf8"),
				);
				const extras = played
					.filter((app) => !ownedIds.has(app.appId) && app.minutes > 0)
					.sort((left, right) => right.minutes - left.minutes)
					.slice(0, topGames);

				const targetIds = new Set(extras.map((app) => app.appId));
				const steamRoot = resolveSteamRoot(localConfigPath);
				const names = readManifestNames(steamRoot, targetIds);
				const cache = readNameCache();

				for (const [appId, name] of cache) {
					if (targetIds.has(appId) && !names.has(appId)) {
						names.set(appId, name);
					}
				}

				const missing = new Set(
					[...targetIds].filter((appId) => !names.has(appId)),
				);
				if (missing.size > 0) {
					console.log(`[games:steam] 解析 ${missing.size} 个本地游戏名称…`);
					const fetched = await fetchAppNames(missing, {
						apiKey,
						timeoutMs,
					});
					for (const [appId, name] of fetched) {
						names.set(appId, name);
						cache.set(appId, name);
					}
					if (fetched.size > 0) writeNameCache(cache);
				}

				const localEntries = [];
				for (const app of extras) {
					const name = names.get(app.appId);
					if (!name) {
						console.warn(
							`[games:steam] 跳过无法确定名称的 AppID ${app.appId}（可能是软件或未在商店上架）。`,
						);
						continue;
					}

					const entry = {
						appId: app.appId,
						name,
						minutes: Math.round(app.minutes),
					};
					if (Number.isFinite(app.recentMinutes) && app.recentMinutes > 0) {
						entry.recentMinutes = Math.round(app.recentMinutes);
					}
					localEntries.push(entry);
				}

				await attachAchievements(localEntries, {
					apiKey,
					steamId,
					timeoutMs,
					delayMs,
					limit: achievementLimit,
					quiet: true,
				});
				await attachCovers(localEntries, {
					enabled: coversEnabled,
					force: args.force,
					dryRun: args.dryRun,
					timeoutMs,
					delayMs,
				});

				const localGames = sortSteamGames(
					localEntries
						.map((entry) => normalizeSteamGame(entry))
						.filter(Boolean),
				);
				const localSnapshot = {
					schemaVersion: 1,
					provider: "steam-local",
					fetchedAt: new Date().toISOString(),
					games: localGames,
				};
				const localJson = `${JSON.stringify(localSnapshot, null, 2)}\n`;

				if (localJson.includes(apiKey)) {
					throw new Error(
						"Security Violation: 本地补录快照中检测到 Steam API Key",
					);
				}

				if (args.dryRun) {
					console.log(localJson);
				} else {
					commitSnapshot({
						targetFile: localFile,
						tempFile: join(directory, `.temp-steam-local-${Date.now()}.json`),
						jsonContent: localJson,
						itemCount: localGames.length,
						// 本机记录归零时需要清空旧补录，不能沿用 keepLastValid。
						keepLastValid: false,
						itemsKey: "games",
					});
					console.log(
						`[games:steam] ✓ 本地补录 ${localGames.length} 款（家庭库/本机记录）：${localFile}`,
					);
				}

				localCount = localGames.length;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				console.warn(
					`[games:steam] 本地补录失败：${message}；保留现有 ${LOCAL_SNAPSHOT_FILENAME}。`,
				);
			}
		}
	}

	if (args.dryRun) {
		console.log("[games:steam] --dry-run：未写入任何文件。");
	} else {
		console.log(
			`[games:steam] 当前展示 ${Math.min(topGames, games.length + localCount)} 款（在线 ${games.length} + 本地 ${localCount}）。`,
		);
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`[games:steam] 同步失败：${message}`);
	process.exitCode = 1;
});
