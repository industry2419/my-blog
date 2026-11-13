/**
 * B 站动态同步：RSSHub → 本地快照 + 站内配图。
 *
 * 设计目标与番剧/游戏同步保持一致：
 * - 构建期只读快照，运行时不产生任何外部请求；
 * - 幂等：图片按「动态 ID + 序号 + 源地址摘要」命名，源地址不变时直接复用；
 * - 失败不破坏上一份有效快照（`keepLastValid`）。
 *
 * 用法：
 *   node scripts/moments/sync.mjs [--dry-run] [--uid <uid>] [--base-url <url>]
 */

import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { resolveBilibiliMomentsOptions } from "../../src/config/momentsConfig.ts";
import { loadEnvFile } from "../anime/load-env.mjs";
import { parseBilibiliDynamicFeed } from "./rss.mjs";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const SNAPSHOT_FILE = "src/data/bilibili-moments.json";
const IMAGE_DIR = "public/images/moments/bilibili";
const IMAGE_ROUTE = "/images/moments/bilibili";
const MAX_IMAGE_SIZE = 1600;
const REQUEST_TIMEOUT_MS = 30_000;
const REQUEST_HEADERS = {
	"user-agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
	referer: "https://www.bilibili.com/",
};

loadEnvFile();

function log(message) {
	console.log(`[moments-sync] ${message}`);
}

function warn(message) {
	console.warn(`[moments-sync] ⚠ ${message}`);
}

function fail(message) {
	console.error(`[moments-sync] ✘ ${message}`);
}

function parseCliArgs() {
	const args = process.argv.slice(2);
	const options = { dryRun: false, uid: "", baseUrl: "", help: false };

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--dry-run") {
			options.dryRun = true;
		} else if (arg === "--help" || arg === "-h") {
			options.help = true;
		} else if (arg === "--uid" && args[index + 1]) {
			options.uid = args[index + 1];
			index += 1;
		} else if (arg.startsWith("--uid=")) {
			options.uid = arg.slice("--uid=".length);
		} else if (arg === "--base-url" && args[index + 1]) {
			options.baseUrl = args[index + 1];
			index += 1;
		} else if (arg.startsWith("--base-url=")) {
			options.baseUrl = arg.slice("--base-url=".length);
		} else {
			fail(`Unsupported argument: ${arg}. Run with --help to see usage.`);
			process.exit(1);
		}
	}

	return options;
}

async function fetchText(url) {
	const response = await fetch(url, {
		headers: {
			...REQUEST_HEADERS,
			accept: "application/rss+xml, application/xml, text/xml",
		},
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}
	return response.text();
}

async function downloadImage(url, targetPath) {
	const response = await fetch(url, {
		headers: REQUEST_HEADERS,
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}

	const input = Buffer.from(await response.arrayBuffer());
	const output = await sharp(input)
		.rotate()
		.resize({
			width: MAX_IMAGE_SIZE,
			height: MAX_IMAGE_SIZE,
			fit: "inside",
			withoutEnlargement: true,
		})
		.webp({ quality: 82 })
		.toBuffer();

	mkdirSync(dirname(targetPath), { recursive: true });
	writeFileSync(targetPath, output);
}

function imageFileName(itemId, index, url) {
	const digest = createHash("sha1").update(url).digest("hex").slice(0, 8);
	const numericId = itemId.replace(/^bili-/, "");
	return `${numericId}-${index}-${digest}.webp`;
}

function readExistingSnapshot() {
	const filePath = join(projectRoot, SNAPSHOT_FILE);
	if (!existsSync(filePath)) return null;
	try {
		const parsed = JSON.parse(readFileSync(filePath, "utf8"));
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
}

function writeSnapshotFile(items, uid) {
	const snapshot = {
		schemaVersion: 1,
		provider: "bilibili",
		uid,
		fetchedAt: new Date().toISOString(),
		items,
	};
	const filePath = join(projectRoot, SNAPSHOT_FILE);
	const tempPath = `${filePath}.${process.pid}.tmp`;
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`);
	renameSync(tempPath, filePath);
	return snapshot;
}

/** 删除本次快照不再引用的旧配图，避免动态删除后文件长期残留。 */
function pruneImages(referencedFiles) {
	const directory = join(projectRoot, IMAGE_DIR);
	if (!existsSync(directory)) return 0;
	let removed = 0;
	for (const file of readdirSync(directory)) {
		if (!file.endsWith(".webp") || referencedFiles.has(file)) continue;
		rmSync(join(directory, file), { force: true });
		removed += 1;
	}
	return removed;
}

function keepLastValidOrFail(reason, options) {
	const snapshot = readExistingSnapshot();
	if (options.keepLastValid && snapshot) {
		warn(`${reason}；已保留上一份有效快照，跳过本次写入。`);
		return 0;
	}
	fail(`${reason}；当前没有可用的有效快照。`);
	return 1;
}

async function main() {
	const cli = parseCliArgs();
	if (cli.help) {
		console.log(
			[
				"Usage: node scripts/moments/sync.mjs [--dry-run] [--uid <uid>] [--base-url <url>]",
				"",
				"  --dry-run         抓取并解析，但不写入快照与图片",
				"  --uid <uid>       本次运行临时覆盖配置里的 B 站 UID",
				"  --base-url <url>  本次运行临时覆盖 RSSHub 实例地址",
			].join("\n"),
		);
		return 0;
	}

	const resolved = resolveBilibiliMomentsOptions();
	const options = {
		...resolved,
		uid: (cli.uid || resolved.uid).trim(),
		rsshubBaseUrl: (cli.baseUrl || resolved.rsshubBaseUrl)
			.trim()
			.replace(/\/+$/, ""),
	};
	options.enable = (cli.uid ? true : resolved.enable) && options.uid !== "";

	if (!options.enable) {
		log(
			"B 站动态同步未启用（config/moments.yaml 的 bilibili.enable 为 false 或 uid 为空），跳过。",
		);
		return 0;
	}

	const feedUrl = `${options.rsshubBaseUrl}/bilibili/user/dynamic/${encodeURIComponent(options.uid)}`;
	log(`抓取 ${feedUrl}`);

	let xml;
	try {
		xml = await fetchText(feedUrl);
	} catch (error) {
		return keepLastValidOrFail(`抓取失败：${error.message}`, options);
	}

	const parsed = parseBilibiliDynamicFeed(xml).slice(0, options.maxItems);
	if (parsed.length === 0) {
		return keepLastValidOrFail("Feed 未返回任何动态", options);
	}

	log(`解析到 ${parsed.length} 条动态`);

	if (cli.dryRun) {
		for (const item of parsed) {
			const preview = item.content.replace(/\s+/g, " ").slice(0, 60);
			console.log(
				`  · ${item.published} ${item.id} images=${item.images.length} ${preview}`,
			);
		}
		log("dry-run：未写入快照与图片。");
		return 0;
	}

	const snapshotItems = [];
	for (const item of parsed) {
		const images = [];

		if (options.downloadImages) {
			for (const [index, url] of item.images.entries()) {
				const fileName = imageFileName(item.id, index, url);
				const targetPath = join(projectRoot, IMAGE_DIR, fileName);
				if (!existsSync(targetPath)) {
					try {
						await downloadImage(url, targetPath);
					} catch (error) {
						warn(`配图下载失败（${item.id} #${index}）：${error.message}`);
						continue;
					}
				}
				images.push({ src: `${IMAGE_ROUTE}/${fileName}`, alt: "" });
			}
		}

		snapshotItems.push({
			id: item.id,
			published: item.published,
			content: item.content,
			url: item.url,
			images,
		});
	}

	writeSnapshotFile(snapshotItems, options.uid);

	const removed = options.downloadImages
		? pruneImages(
				new Set(
					snapshotItems.flatMap((item) =>
						item.images.map((image) => basename(image.src)),
					),
				),
			)
		: 0;

	log(
		`✓ 已写入 ${snapshotItems.length} 条动态与 ${snapshotItems.reduce((total, item) => total + item.images.length, 0)} 张配图` +
			`${removed > 0 ? `，清理 ${removed} 张旧图` : ""} → ${SNAPSHOT_FILE}`,
	);
	return 0;
}

main()
	.then((code) => {
		process.exitCode = code;
	})
	.catch((error) => {
		fail(`Fatal error: ${error.message}`);
		process.exitCode = 1;
	});
