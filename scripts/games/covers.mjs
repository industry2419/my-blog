import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { gamesConfig, resolveGamesOptions } from "../../src/config/gamesConfig.ts";

/**
 * 同步游戏「当前版本」主视觉，作为游戏卡片的自动封面。
 *
 * 数据源：米游社官方账号发布的版本 PV 帖（视频帖封面即官方版本主视觉），
 * 按游戏论坛 ID 过滤，只接受官方、视频帖、16:9 左右的大图。
 *
 * 产物：
 * - `public/games-art/<gameId>.webp` —— 已压缩的站内封面；
 * - `src/data/games-snapshots/covers.json` —— 构建期只读的路径映射。
 *
 * 单个游戏失败时保留上一次有效封面，不影响其他游戏与资历同步。
 */

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

const SEARCH_ENDPOINT = "https://bbs-api.miyoushe.com/post/wapi/searchPosts";
const SEARCH_KEYWORD = "版本PV";
const SEARCH_SIZE = 50;
const REQUEST_HEADERS = {
	"User-Agent": "Shirone-Games-Covers/1.0",
	Referer: "https://www.miyoushe.com/",
};

const OUTPUT_DIRECTORY = "games-art";
const COVERS_FILENAME = "covers.json";

/** 各游戏在米游社的论坛 game_id 与需要排除的子版本 PV。 */
const TARGETS = [
	{
		gameId: "genshin-impact",
		forumGameId: 2,
		exclude: /套装PV|千星奇域|角色PV|音乐/,
	},
	{
		gameId: "honkai-star-rail",
		forumGameId: 6,
		exclude: /角色PV|预下载|攻略|千星奇域/,
	},
	{
		gameId: "zenless-zone-zero",
		forumGameId: 8,
		exclude: /角色PV|代理人|攻略/,
	},
];

const MIN_WIDTH = 1200;
const MIN_ASPECT = 1.4;
const MAX_ASPECT = 2.8;
const OUTPUT_WIDTH = 1280;
const WEBP_QUALITY = 84;
const SEARCH_TIMEOUT_MS = 20000;
const IMAGE_TIMEOUT_MS = 30000;

function parseArgs(argv) {
	const result = { games: [], dryRun: false, force: false };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--dry-run") {
			result.dryRun = true;
		} else if (arg === "--force") {
			result.force = true;
		} else if (arg === "--game") {
			const value = argv[index + 1];
			if (value && !value.startsWith("--")) {
				result.games.push(...value.split(","));
				index += 1;
			}
		} else if (arg.startsWith("--game=")) {
			result.games.push(...arg.slice("--game=".length).split(","));
		}
	}
	result.games = result.games.map((game) => game.trim()).filter(Boolean);
	return result;
}

function resolveSnapshotDirectory() {
	const options = resolveGamesOptions(gamesConfig);
	const directory = options.snapshot.directory;
	return directory.startsWith("/") || /^[A-Za-z]:/.test(directory)
		? directory
		: join(projectRoot, directory);
}

function readPreviousSnapshot(filePath) {
	if (!existsSync(filePath)) return { covers: {}, sources: {}, fetchedAt: "" };
	try {
		const record = JSON.parse(readFileSync(filePath, "utf-8"));
		return {
			covers:
				record?.covers && typeof record.covers === "object"
					? record.covers
					: {},
			sources:
				record?.sources && typeof record.sources === "object"
					? record.sources
					: {},
			fetchedAt: typeof record?.fetchedAt === "string" ? record.fetchedAt : "",
		};
	} catch {
		return { covers: {}, sources: {}, fetchedAt: "" };
	}
}

async function fetchJson(url) {
	const response = await fetch(url, {
		headers: REQUEST_HEADERS,
		signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return response.json();
}

/**
 * 拉取官方版本 PV 候选帖，按发布时间从新到旧排序。
 * 搜索一次即可覆盖所有游戏，减少请求与风控风险。
 */
async function fetchPvCandidates() {
	const url = `${SEARCH_ENDPOINT}?keyword=${encodeURIComponent(SEARCH_KEYWORD)}&size=${SEARCH_SIZE}`;
	const payload = await fetchJson(url);
	if (payload?.retcode !== 0) {
		throw new Error(`搜索接口返回 retcode=${payload?.retcode}`);
	}

	return (payload.data?.posts ?? [])
		.map((entry) => entry?.post)
		.filter(Boolean)
		.filter((post) => post.post_status?.is_official === true)
		.filter((post) => Number(post.view_type) === 5)
		.filter((post) => typeof post.cover === "string" && post.cover.startsWith("https://"))
		.filter(
			(post) =>
				typeof post.subject === "string" && post.subject.includes(SEARCH_KEYWORD),
		)
		.sort((a, b) => Number(b.created_at) - Number(a.created_at));
}

async function downloadImage(url) {
	const response = await fetch(url, {
		headers: REQUEST_HEADERS,
		signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return Buffer.from(await response.arrayBuffer());
}

/** 校验构图并转成站内 WebP；不合格时抛错以便尝试下一条候选。 */
async function convertCover(buffer) {
	const metadata = await sharp(buffer).metadata();
	const width = metadata.width ?? 0;
	const height = metadata.height ?? 0;
	const aspect = height > 0 ? width / height : 0;

	if (width < MIN_WIDTH) {
		throw new Error(`宽 ${width}px 低于 ${MIN_WIDTH}px`);
	}
	if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) {
		throw new Error(`宽高比 ${aspect.toFixed(2)} 超出 ${MIN_ASPECT}–${MAX_ASPECT}`);
	}

	const { data, info } = await sharp(buffer)
		.resize({ width: OUTPUT_WIDTH, withoutEnlargement: true })
		.webp({ quality: WEBP_QUALITY })
		.toBuffer({ resolveWithObject: true });

	return { data, info };
}

async function syncTarget(target, candidates, previous, args) {
	const outputPath = join(
		projectRoot,
		"public",
		OUTPUT_DIRECTORY,
		`${target.gameId}.webp`,
	);
	const publicPath = `/${OUTPUT_DIRECTORY}/${target.gameId}.webp`;

	const matches = candidates.filter(
		(post) =>
			Number(post.game_id) === target.forumGameId &&
			!target.exclude.test(post.subject),
	);

	if (matches.length === 0) {
		throw new Error("没有找到官方版本 PV 帖");
	}

	for (const post of matches) {
		const sourceUrl = post.cover;

		if (
			!args.force &&
			previous.sources[target.gameId] === sourceUrl &&
			existsSync(outputPath)
		) {
			console.log(`[games:covers] ${target.gameId} 无新版本，复用 ${publicPath}`);
			return { gameId: target.gameId, path: publicPath, sourceUrl };
		}

		try {
			const buffer = await downloadImage(sourceUrl);
			const { data, info } = await convertCover(buffer);

			if (!args.dryRun) {
				mkdirSync(dirname(outputPath), { recursive: true });
				writeFileSync(outputPath, data);
			}

			console.log(
				`[games:covers] ${target.gameId} → ${info.width}x${info.height}, ${Math.round(info.size / 1024)}KB（${post.subject}）`,
			);
			return { gameId: target.gameId, path: publicPath, sourceUrl };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.warn(
				`[games:covers] ${target.gameId} 候选被跳过（${message}），尝试下一条`,
			);
		}
	}

	throw new Error("所有候选封面均未通过校验");
}

async function main() {
	if (!gamesConfig.enable) {
		console.log("[games:covers] 游戏页已关闭，跳过。");
		return;
	}

	const args = parseArgs(process.argv.slice(2));
	const targets = args.games.length
		? TARGETS.filter((target) => args.games.includes(target.gameId))
		: TARGETS;

	if (targets.length === 0) {
		console.warn("[games:covers] 未匹配到任何游戏。");
		return;
	}

	const snapshotDirectory = resolveSnapshotDirectory();
	const coversFile = join(snapshotDirectory, COVERS_FILENAME);
	const previous = readPreviousSnapshot(coversFile);

	const covers = {};
	for (const [gameId, path] of Object.entries(previous.covers)) {
		if (
			typeof path === "string" &&
			existsSync(join(projectRoot, "public", path))
		) {
			covers[gameId] = path;
		}
	}
	const sources = { ...previous.sources };

	let candidates;
	try {
		candidates = await fetchPvCandidates();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[games:covers] 搜索失败：${message}；保留现有封面。`);
		process.exitCode = 1;
		return;
	}

	let failed = 0;
	for (const target of targets) {
		try {
			const result = await syncTarget(target, candidates, previous, args);
			covers[result.gameId] = result.path;
			sources[result.gameId] = result.sourceUrl;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failed += 1;
			console.warn(`[games:covers] ${target.gameId} 同步失败：${message}；保留现有封面。`);
		}
	}

	if (args.dryRun) {
		console.log("[games:covers] --dry-run：未写入任何文件。");
		return;
	}

	// 版本未变时不重写快照，避免定时任务每天产生只有时间戳的提交。
	const unchanged =
		JSON.stringify(covers) === JSON.stringify(previous.covers) &&
		JSON.stringify(sources) === JSON.stringify(previous.sources);
	if (unchanged && existsSync(coversFile)) {
		console.log("[games:covers] 封面未变化，跳过写入。");
		if (failed === targets.length) process.exitCode = 1;
		return;
	}

	const snapshot = {
		schemaVersion: 1,
		fetchedAt: new Date().toISOString(),
		covers,
		sources,
	};
	mkdirSync(snapshotDirectory, { recursive: true });
	const tempFile = `${coversFile}.tmp`;
	writeFileSync(tempFile, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
	renameSync(tempFile, coversFile);
	console.log(`[games:covers] 已写入 ${coversFile}（${Object.keys(covers).length} 张封面）`);

	if (failed === targets.length) {
		process.exitCode = 1;
	}
}

await main();
