import type { GameCoversSnapshot } from "../../types/gamesConfig.ts";

/** 游戏 ID 只允许小写字母、数字与连字符（与 URL 片段一致）。 */
const SAFE_GAME_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** 自动封面只接受脚本生成的站内路径，避免快照被改写后指向任意文件。 */
const SAFE_COVER_PATH = /^\/games-art\/[a-z0-9-]+\.(?:webp|avif|jpg|jpeg|png)$/;

/**
 * 解析 `games:covers` 生成的封面快照。
 *
 * 契约：不访问网络、不读写文件；仅做结构校验，非法条目逐条丢弃。
 * 没有任何有效条目时返回 null，调用方据此保持原封面。
 */
export function parseGameCovers(content: string): GameCoversSnapshot | null {
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
	if (snapshot.schemaVersion !== 1) return null;

	const rawCovers = snapshot.covers;
	if (!rawCovers || typeof rawCovers !== "object" || Array.isArray(rawCovers)) {
		return null;
	}

	const covers: Record<string, string> = {};
	for (const [gameId, value] of Object.entries(rawCovers)) {
		if (!SAFE_GAME_ID.test(gameId)) continue;
		if (typeof value !== "string" || !SAFE_COVER_PATH.test(value)) continue;
		covers[gameId] = value;
	}

	if (Object.keys(covers).length === 0) return null;

	return {
		schemaVersion: 1,
		fetchedAt: typeof snapshot.fetchedAt === "string" ? snapshot.fetchedAt : "",
		covers,
	};
}
