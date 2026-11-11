import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const BANGUMI_API_BASE = "https://api.bgm.tv";
const USER_AGENT = "Shirone/1.0 (https://github.com/shirone; AnimeSync)";

const projectRoot = fileURLToPath(new URL("../../../", import.meta.url));
const COVER_WIDTH = 220;
const COVER_HEIGHT = 280;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const STATUS_COLLECTIONS = [
	{ type: 3, status: "watching" },
	{ type: 2, status: "completed" },
	{ type: 1, status: "planned" },
	{ type: 4, status: "onHold" },
	{ type: 5, status: "dropped" },
];

function extractStudioFromInfobox(infobox) {
	if (!Array.isArray(infobox)) return undefined;
	const targetKeys = [
		"动画制作",
		"制作",
		"製作",
		"开发",
		"Animation Production",
	];

	for (const key of targetKeys) {
		const item = infobox.find((i) => i.key === key);
		if (item) {
			if (typeof item.value === "string" && item.value.trim()) {
				return item.value.trim();
			}
			if (Array.isArray(item.value)) {
				const validItem = item.value.find(
					(v) => v && (v.v || typeof v === "string"),
				);
				if (validItem) {
					return typeof validItem === "string"
						? validItem.trim()
						: validItem.v?.trim();
				}
			}
		}
	}
	return undefined;
}

async function fetchJson(url, timeoutMs = 15000) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			headers: {
				"User-Agent": USER_AGENT,
				Accept: "application/json",
			},
		});
		if (!res.ok) {
			return { ok: false, status: res.status, statusText: res.statusText };
		}
		const data = await res.json();
		return { ok: true, data };
	} catch (error) {
		return { ok: false, error };
	} finally {
		clearTimeout(timer);
	}
}

async function fetchSubjectDetail(subjectId) {
	const res = await fetchJson(
		`${BANGUMI_API_BASE}/v0/subjects/${subjectId}`,
		10000,
	);
	if (res.ok && res.data) {
		return res.data;
	}
	return null;
}

/**
 * 下载封面到站内缓存（220×280 WebP），已存在则直接复用
 */
async function downloadCoverLocally(coverUrl, subjectId) {
	if (!coverUrl?.startsWith("http") || !subjectId) return undefined;

	const coversDir = join(projectRoot, "public/assets/anime/covers");
	const fileName = `bangumi_${subjectId}.webp`;
	const filePath = join(coversDir, fileName);

	try {
		if (!existsSync(coversDir)) {
			mkdirSync(coversDir, { recursive: true });
		}
		if (existsSync(filePath)) {
			return `/assets/anime/covers/${fileName}`;
		}

		const res = await fetchCoverWithRetry(coverUrl);
		if (!res?.ok) return undefined;

		const buffer = Buffer.from(await res.arrayBuffer());
		const webp = await sharp(buffer)
			.resize(COVER_WIDTH, COVER_HEIGHT, { fit: "cover" })
			.webp({ quality: 82 })
			.toBuffer();
		writeFileSync(filePath, webp);
		return `/assets/anime/covers/${fileName}`;
	} catch (error) {
		console.warn(
			`[Bangumi] Failed to download cover locally for ${subjectId}: ${error.message}`,
		);
		return undefined;
	}
}

/**
 * 并发下载时 Cloudflare 偶发重置连接，失败后重试两次
 */
async function fetchCoverWithRetry(url, attempts = 3) {
	for (let i = 0; i < attempts; i++) {
		try {
			const res = await fetch(url, {
				headers: { "User-Agent": USER_AGENT },
				signal: AbortSignal.timeout(15000),
			});
			if (res.ok) return res;
		} catch {
			// 继续重试
		}
		if (i < attempts - 1) await delay(400 * (i + 1));
	}
	return undefined;
}

/**
 * 获取单个状态类别的用户收藏列表
 */
async function fetchCollectionType(userId, type, status, options) {
	const pageSize = Math.min(Math.max(10, options.pageSize || 50), 100);
	const maxItems = options.maxItems || 100;
	const minDelayMs = options.minDelayMs || 200;

	let offset = 0;
	let hasMore = true;
	const collected = [];

	while (hasMore && collected.length < maxItems) {
		const limit = Math.min(pageSize, maxItems - collected.length);
		const url = `${BANGUMI_API_BASE}/v0/users/${encodeURIComponent(userId)}/collections?subject_type=2&type=${type}&limit=${limit}&offset=${offset}`;

		const res = await fetchJson(url);
		if (!res.ok) {
			if (res.status === 404) {
				console.log(
					`   [Bangumi] User ${userId} has no data or 404 for type ${type}`,
				);
				return [];
			}
			console.warn(
				`   [Bangumi] Request failed for type ${type}: HTTP ${res.status || res.error?.message}`,
			);
			break;
		}

		const data = res.data;
		if (data && Array.isArray(data.data) && data.data.length > 0) {
			collected.push(...data.data);
			if (
				data.data.length < limit ||
				collected.length >= (data.total || maxItems)
			) {
				hasMore = false;
			} else {
				offset += limit;
				await delay(minDelayMs);
			}
		} else {
			hasMore = false;
		}
	}

	return collected.map((item) => ({ item, status }));
}

/**
 * Bangumi 提供方数据抓取入口
 */
export async function fetchBangumiData(bangumiConfig) {
	const userId = bangumiConfig.userId?.trim();
	if (!userId) {
		throw new Error(
			"Bangumi userId is required in animeConfig.providers.bangumi.userId",
		);
	}

	const requestOptions = bangumiConfig.request || {};
	const coverConfig = bangumiConfig.cover || { mode: "remote" };
	console.log(`[Bangumi] Starting sync for user: ${userId}...`);

	const allEntries = [];
	for (const { type, status } of STATUS_COLLECTIONS) {
		console.log(
			`[Bangumi] Fetching collection status "${status}" (type ${type})...`,
		);
		const entries = await fetchCollectionType(
			userId,
			type,
			status,
			requestOptions,
		);
		allEntries.push(...entries);
		console.log(
			`[Bangumi] Fetched ${entries.length} items for status "${status}".`,
		);
	}

	console.log(
		`[Bangumi] Total raw items collected: ${allEntries.length}. Fetching details with concurrency...`,
	);

	const rawAnimeItems = [];
	const CONCURRENCY = 6;
	const BATCH_DELAY = 100;

	for (let i = 0; i < allEntries.length; i += CONCURRENCY) {
		const batch = allEntries.slice(i, i + CONCURRENCY);
		const batchResults = await Promise.all(
			batch.map(async ({ item, status }) => {
				const subjectId = item.subject_id;
				const subject = item.subject || {};

				let detail = null;
				if (subjectId) {
					detail = await fetchSubjectDetail(subjectId);
				}

				const title =
					subject.name_cn ||
					subject.name ||
					detail?.name_cn ||
					detail?.name ||
					"";
				if (!title.trim()) return null;

				const rating =
					typeof item.rate === "number" && item.rate > 0
						? item.rate
						: typeof subject.score === "number"
							? subject.score
							: typeof detail?.rating?.score === "number"
								? detail.rating.score
								: 0;

				const watched = typeof item.ep_status === "number" ? item.ep_status : 0;
				const total =
					typeof subject.eps === "number" && subject.eps > 0
						? subject.eps
						: typeof detail?.eps === "number" && detail.eps > 0
							? detail.eps
							: typeof detail?.total_episodes === "number"
								? detail.total_episodes
								: 0;

				const remoteCover =
					subject.images?.medium ||
					subject.images?.large ||
					subject.images?.common ||
					detail?.images?.medium ||
					detail?.images?.large ||
					"";

				let cover = remoteCover;
				if (remoteCover && coverConfig.mode === "local") {
					cover =
						(await downloadCoverLocally(remoteCover, subjectId)) || remoteCover;
				} else if (coverConfig.mode === "none") {
					cover = "";
				}

				const rawDate = subject.date || detail?.date || "";
				const year = rawDate ? String(rawDate).slice(0, 4) : "";

				const description =
					detail?.summary ||
					subject.short_summary ||
					detail?.short_summary ||
					"";

				const studio = extractStudioFromInfobox(detail?.infobox);

				const rawTags = Array.isArray(subject.tags)
					? subject.tags
							.map((t) => (typeof t === "string" ? t : t?.name))
							.filter(Boolean)
					: Array.isArray(detail?.tags)
						? detail.tags
								.map((t) => (typeof t === "string" ? t : t?.name))
								.filter(Boolean)
						: [];

				const link = subjectId
					? `https://bgm.tv/subject/${subjectId}`
					: undefined;

				return {
					title,
					status,
					rating,
					progress: { watched, total },
					cover: cover || undefined,
					link,
					description: description || undefined,
					year,
					studio,
					genres: rawTags,
					identity: {
						provider: "bangumi",
						subjectId: subjectId ? String(subjectId) : undefined,
					},
				};
			}),
		);

		for (const res of batchResults) {
			if (res) rawAnimeItems.push(res);
		}

		const processedCount = Math.min(i + CONCURRENCY, allEntries.length);
		if (processedCount % 30 === 0 || processedCount === allEntries.length) {
			console.log(
				`[Bangumi] Processed ${processedCount}/${allEntries.length} items...`,
			);
		}

		if (i + CONCURRENCY < allEntries.length) {
			await delay(BATCH_DELAY);
		}
	}

	return {
		provider: "bangumi",
		accountRef: userId,
		rawItems: rawAnimeItems,
	};
}
