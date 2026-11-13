/**
 * 飞书 → 内容仓 的动态发布器。
 *
 * 链路：飞书自建应用（机器人）所在的会话 → 本脚本轮询最近消息 →
 * 渲染为 `content/moments/*.md` + 下载配图到 `public/images/moments/feishu/`。
 * 由 `.github/workflows/moments-feishu.yml` 每 30 分钟运行一次。
 *
 * 幂等：动态文件名由「北京日期 + 首条消息 ID」决定，重复轮询不会重复写入。
 * 开关：未配置 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `FEISHU_CHAT_ID` 时
 * 直接跳过（退出码 0），与主题的零额外负担约定一致。
 *
 * 用法：
 *   node scripts/moments/feishu.mjs [--content-dir <dir>] [--dry-run]
 *                                   [--since-hours <n>] [--gap-minutes <n>]
 *                                   [--grace-minutes <n>]
 */

import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadEnvFile } from "../anime/load-env.mjs";
import {
	groupFeishuMoments,
	momentFileName,
	momentImageFileName,
	parseFeishuMessage,
	renderMomentMarkdown,
} from "./feishu-parse.mjs";

const DEFAULT_API_BASE = "https://open.feishu.cn";
const REQUEST_TIMEOUT_MS = 20_000;
const PAGE_SIZE = 50;
const MAX_PAGES = 40;
const MOMENTS_DIR = "content/moments";
const IMAGE_DIR = "public/images/moments/feishu";
const IMAGE_ROUTE = "/images/moments/feishu";

const EXTENSION_BY_CONTENT_TYPE = {
	"image/jpeg": "jpg",
	"image/jpg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/bmp": "bmp",
	"image/avif": "avif",
};

function log(message) {
	console.log(`[moments-feishu] ${message}`);
}

function warn(message) {
	console.warn(`[moments-feishu] ⚠ ${message}`);
}

function fail(message) {
	console.error(`[moments-feishu] ✘ ${message}`);
}

function parseCliArgs() {
	const args = process.argv.slice(2);
	const options = {
		contentDir: "",
		dryRun: false,
		help: false,
		sinceHours: 168,
		gapMinutes: 5,
		graceMinutes: 10,
	};

	const readNumber = (raw, label) => {
		const value = Number(raw);
		if (!Number.isFinite(value) || value < 0) {
			fail(`${label} 需要一个非负数字，收到 ${JSON.stringify(raw)}。`);
			process.exit(1);
		}
		return value;
	};

	const readValue = (arg, args, index) => {
		const inline = arg.includes("=") ? arg.slice(arg.indexOf("=") + 1) : "";
		if (inline) return { value: inline, consumed: 0 };
		if (!args[index + 1]) {
			fail(`${arg} 缺少参数值。`);
			process.exit(1);
		}
		return { value: args[index + 1], consumed: 1 };
	};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--dry-run") {
			options.dryRun = true;
		} else if (arg === "--help" || arg === "-h") {
			options.help = true;
		} else if (arg === "--content-dir" || arg.startsWith("--content-dir=")) {
			const { value, consumed } = readValue(arg, args, index);
			options.contentDir = value;
			index += consumed;
		} else if (arg === "--since-hours" || arg.startsWith("--since-hours=")) {
			const { value, consumed } = readValue(arg, args, index);
			options.sinceHours = readNumber(value, "--since-hours", options.sinceHours);
			index += consumed;
		} else if (arg === "--gap-minutes" || arg.startsWith("--gap-minutes=")) {
			const { value, consumed } = readValue(arg, args, index);
			options.gapMinutes = readNumber(value, "--gap-minutes", options.gapMinutes);
			index += consumed;
		} else if (arg === "--grace-minutes" || arg.startsWith("--grace-minutes=")) {
			const { value, consumed } = readValue(arg, args, index);
			options.graceMinutes = readNumber(value, "--grace-minutes", options.graceMinutes);
			index += consumed;
		} else {
			fail(`不支持的参数：${arg}。使用 --help 查看用法。`);
			process.exit(1);
		}
	}

	return options;
}

function printHelp() {
	console.log(`飞书动态发布器

用法：
  node scripts/moments/feishu.mjs [options]

选项：
  --content-dir <dir>   内容仓目录（默认取 CONTENT_DIR）
  --since-hours <n>     回看窗口，默认 168（7 天）
  --gap-minutes <n>     同一发送者连续消息的合并窗口，默认 5
  --grace-minutes <n>   新消息的宽限时间，默认 10
  --dry-run             只打印将要写入的文件，不下载图片、不落盘
  --help, -h            显示本帮助

环境变量：
  FEISHU_APP_ID         自建应用 App ID
  FEISHU_APP_SECRET     自建应用 App Secret
  FEISHU_CHAT_ID        接收动态的会话 ID（建议与机器人单聊）
  CONTENT_DIR           内容仓目录（--content-dir 优先）
  FEISHU_API_BASE       可选，默认 https://open.feishu.cn
`);
}

async function requestJson(url, options = {}) {
	const response = await fetch(url, {
		...options,
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	const body = await response.text();
	let payload = {};
	if (body) {
		try {
			payload = JSON.parse(body);
		} catch {
			throw new Error(`响应不是 JSON（HTTP ${response.status}）：${body.slice(0, 160)}`);
		}
	}
	if (!response.ok) {
		throw new Error(
			`HTTP ${response.status} ${response.statusText}：${payload.msg ?? body.slice(0, 160)}`,
		);
	}
	if (typeof payload.code === "number" && payload.code !== 0) {
		throw new Error(`飞书接口返回 ${payload.code}：${payload.msg ?? "unknown error"}`);
	}
	return payload;
}

async function getTenantAccessToken(apiBase, appId, appSecret) {
	const payload = await requestJson(
		`${apiBase}/open-apis/auth/v3/tenant_access_token/internal`,
		{
			method: "POST",
			headers: { "content-type": "application/json; charset=utf-8" },
			body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
		},
	);
	if (!payload.tenant_access_token) {
		throw new Error("tenant_access_token 为空，请检查应用凭据。");
	}
	return payload.tenant_access_token;
}

async function listChatMessages(apiBase, token, chatId, startSeconds, endSeconds) {
	const items = [];
	let pageToken = "";

	for (let page = 0; page < MAX_PAGES; page += 1) {
		const params = new URLSearchParams({
			container_id_type: "chat",
			container_id: chatId,
			start_time: String(startSeconds),
			end_time: String(endSeconds),
			sort_type: "ByCreateTimeAsc",
			page_size: String(PAGE_SIZE),
		});
		if (pageToken) params.set("page_token", pageToken);

		const payload = await requestJson(
			`${apiBase}/open-apis/im/v1/messages?${params.toString()}`,
			{ headers: { authorization: `Bearer ${token}` } },
		);

		const data = payload.data ?? {};
		items.push(...(Array.isArray(data.items) ? data.items : []));
		if (!data.has_more) break;
		pageToken = String(data.page_token ?? "");
		if (!pageToken) break;
	}

	return items;
}

async function downloadImage(apiBase, token, imageKey) {
	const response = await fetch(
		`${apiBase}/open-apis/im/v1/images/${encodeURIComponent(imageKey)}`,
		{
			headers: { authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		},
	);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}
	const contentType = (response.headers.get("content-type") ?? "")
		.split(";")[0]
		.trim()
		.toLowerCase();
	const buffer = Buffer.from(await response.arrayBuffer());
	if (buffer.length === 0) throw new Error("图片内容为空");
	return { buffer, extension: EXTENSION_BY_CONTENT_TYPE[contentType] ?? "jpg" };
}

function writeFileAtomic(target, content) {
	const temporary = `${target}.tmp`;
	writeFileSync(temporary, content);
	renameSync(temporary, target);
}

async function main() {
	const options = parseCliArgs();
	if (options.help) {
		printHelp();
		return;
	}

	loadEnvFile();

	const appId = String(process.env.FEISHU_APP_ID ?? "").trim();
	const appSecret = String(process.env.FEISHU_APP_SECRET ?? "").trim();
	const chatId = String(process.env.FEISHU_CHAT_ID ?? "").trim();

	if (!appId || !appSecret || !chatId) {
		const message =
			"未配置 FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_CHAT_ID，跳过飞书动态发布。";
		if (process.env.GITHUB_ACTIONS === "true") {
			console.log(`::notice::${message}`);
		} else {
			log(message);
		}
		return;
	}

	const rawContentDir = options.contentDir || process.env.CONTENT_DIR || "";
	if (!rawContentDir) {
		fail("缺少内容仓目录。请用 --content-dir 或 CONTENT_DIR 指定。");
		process.exitCode = 1;
		return;
	}
	const contentDir = resolve(rawContentDir);
	if (!existsSync(contentDir)) {
		fail(`内容仓目录不存在：${contentDir}`);
		process.exitCode = 1;
		return;
	}

	const apiBase = String(process.env.FEISHU_API_BASE ?? DEFAULT_API_BASE)
		.trim()
		.replace(/\/+$/, "");

	const now = Date.now();
	const startSeconds = Math.floor((now - options.sinceHours * 3600 * 1000) / 1000);
	const endSeconds = Math.floor(now / 1000);

	log(`拉取会话 ${chatId} 最近 ${options.sinceHours} 小时的消息…`);

	const token = await getTenantAccessToken(apiBase, appId, appSecret);
	const rawItems = await listChatMessages(apiBase, token, chatId, startSeconds, endSeconds);
	const messages = rawItems.map(parseFeishuMessage).filter(Boolean);

	const groups = groupFeishuMoments(messages, {
		gapMs: options.gapMinutes * 60 * 1000,
		graceMs: options.graceMinutes * 60 * 1000,
		now,
	});

	log(`消息 ${messages.length} 条，合并为 ${groups.length} 条待发布动态。`);

	const momentsDir = join(contentDir, MOMENTS_DIR);
	const imageDir = join(contentDir, IMAGE_DIR);
	let created = 0;
	let skipped = 0;
	let imageCount = 0;
	let imageFailures = 0;

	for (const group of groups) {
		const fileName = momentFileName(group);
		const target = join(momentsDir, fileName);

		if (existsSync(target)) {
			skipped += 1;
			continue;
		}

		const imagePaths = [];
		const imageKeys = [...new Set(group.imageKeys)];

		for (let index = 0; index < imageKeys.length; index += 1) {
			// dry-run 无法得知扩展名，统一按 jpg 展示计划路径。
			if (options.dryRun) {
				imagePaths.push(
					`${IMAGE_ROUTE}/${momentImageFileName(group, index, "jpg")}`,
				);
				continue;
			}

			try {
				const image = await downloadImage(apiBase, token, imageKeys[index]);
				const imageName = momentImageFileName(group, index, image.extension);
				mkdirSync(imageDir, { recursive: true });
				writeFileSync(join(imageDir, imageName), image.buffer);
				imagePaths.push(`${IMAGE_ROUTE}/${imageName}`);
				imageCount += 1;
			} catch (error) {
				imageFailures += 1;
				warn(`配图 ${imageKeys[index]} 下载失败：${error.message}`);
			}
		}

		const markdown = renderMomentMarkdown(group, imagePaths);

		if (options.dryRun) {
			log(`[dry-run] 将写入 ${MOMENTS_DIR}/${fileName}`);
			console.log(markdown);
			created += 1;
			continue;
		}

		mkdirSync(momentsDir, { recursive: true });
		writeFileAtomic(target, markdown);
		created += 1;
		log(`已写入 ${MOMENTS_DIR}/${fileName}（配图 ${imagePaths.length} 张）`);
	}

	const summary = [
		`新建 ${created} 条`,
		`跳过已存在 ${skipped} 条`,
		`下载配图 ${imageCount} 张`,
	];
	if (imageFailures > 0) summary.push(`配图失败 ${imageFailures} 张`);
	log(summary.join("，"));
}

main().catch((error) => {
	fail(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
