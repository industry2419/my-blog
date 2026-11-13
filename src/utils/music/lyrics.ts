import type { ResolvedMusicOptions } from "@/config/musicConfig";
import type { TrackDescriptor } from "@/types/musicConfig";
import {
	buildMetingLrcUrl,
	DEFAULT_METING_SERVER,
	parseMetingTrackId,
} from "./meting";

export interface LyricLine {
	/** 起始时间（秒）。 */
	readonly time: number;
	readonly text: string;
}

export type LyricFetch = typeof fetch;

const EMPTY_LYRICS: readonly LyricLine[] = Object.freeze([]);
const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

/** 进程内缓存：同一首歌只请求一次；空结果同样缓存，避免反复打空请求。 */
const lyricCache = new Map<string, readonly LyricLine[]>();
const pendingRequests = new Map<string, Promise<readonly LyricLine[]>>();

/**
 * 解析 LRC 文本。支持一行多个时间标签与 `[mm:ss.xx]` / `[mm:ss:xx]` 两种写法；
 * 元信息标签（如 `[ti:...]`）与空文本行会被忽略。
 */
export function parseLrc(raw: string): readonly LyricLine[] {
	if (!raw.trim()) return EMPTY_LYRICS;

	const lines: LyricLine[] = [];
	for (const sourceLine of raw.split(/\r?\n/)) {
		TIME_TAG.lastIndex = 0;
		const tags = [...sourceLine.matchAll(TIME_TAG)];
		if (tags.length === 0) continue;
		const text = sourceLine.replace(TIME_TAG, "").trim();
		if (!text) continue;

		for (const tag of tags) {
			const minutes = Number(tag[1]);
			const seconds = Number(tag[2]);
			const fractionRaw = tag[3] ?? "0";
			const fraction = Number(fractionRaw) / 10 ** fractionRaw.length;
			const time = minutes * 60 + seconds + fraction;
			if (Number.isFinite(time)) lines.push({ time, text });
		}
	}

	if (lines.length === 0) return EMPTY_LYRICS;
	lines.sort((a, b) => a.time - b.time);
	return Object.freeze(lines);
}

/**
 * 二分查找当前时间对应的歌词行；早于第一句时返回 -1。
 * 10ms 容差避免浮点取整导致的「差一帧」。
 */
export function findActiveLyricIndex(
	lines: readonly LyricLine[],
	time: number,
): number {
	let low = 0;
	let high = lines.length - 1;
	let result = -1;
	while (low <= high) {
		const middle = (low + high) >> 1;
		const line = lines[middle];
		if (line && line.time <= time + 0.01) {
			result = middle;
			low = middle + 1;
		} else {
			high = middle - 1;
		}
	}
	return result;
}

/**
 * Meting 的歌词接口有时返回纯文本，有时返回 JSON 字符串
 * （`"..."` 或 `{ lrc: "..." }`），这里统一还原为 LRC 原文。
 */
function normalizeLyricPayload(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return "";
	if (!trimmed.startsWith('"') && !trimmed.startsWith("{")) return trimmed;
	try {
		const parsed: unknown = JSON.parse(trimmed);
		if (typeof parsed === "string") return parsed;
		if (parsed && typeof parsed === "object") {
			const record = parsed as Record<string, unknown>;
			const value = record.lrc ?? record.lyric ?? record.lyrics;
			if (typeof value === "string") return value;
		}
	} catch {
		// 不是合法 JSON：按纯文本处理。
	}
	return trimmed;
}

function resolveLyricKey(
	track: TrackDescriptor,
	options: ResolvedMusicOptions,
): { key: string; url: string } | null {
	// 本地曲目可在数据源里直接声明 LRC 地址；未声明时才回退到 Meting 歌曲 ID。
	if (track.lrc) return { key: `track:${track.id}`, url: track.lrc };

	const meting = options.meting;
	if (!meting?.id) return null;
	if (options.provider !== "meting" && options.provider !== "mixed")
		return null;

	const server = meting.server?.trim() || DEFAULT_METING_SERVER;
	const songId = parseMetingTrackId(track.id, server);
	if (!songId) return null;
	const url = buildMetingLrcUrl(meting, songId);
	if (!url) return null;
	return { key: `${server}:${songId}`, url };
}

/**
 * 按需加载一首歌的歌词。仅在使用者展开歌词面板时调用，
 * 未展开时不产生任何请求；结果（含空结果）会缓存并复用进行中的请求。
 */
export async function loadTrackLyrics(
	track: TrackDescriptor,
	options: ResolvedMusicOptions,
	fetchImpl: LyricFetch | null = typeof fetch === "undefined" ? null : fetch,
): Promise<readonly LyricLine[]> {
	const target = resolveLyricKey(track, options);
	if (!target || !fetchImpl) return EMPTY_LYRICS;

	const cached = lyricCache.get(target.key);
	if (cached) return cached;

	const pending = pendingRequests.get(target.key);
	if (pending) return pending;

	const request = (async (): Promise<readonly LyricLine[]> => {
		try {
			const response = await fetchImpl(target.url);
			if (!response.ok) return EMPTY_LYRICS;
			const lines = parseLrc(normalizeLyricPayload(await response.text()));
			lyricCache.set(target.key, lines);
			return lines;
		} catch {
			// 歌词是可选增强：网络失败只显示「暂无歌词」，不影响播放。
			return EMPTY_LYRICS;
		} finally {
			pendingRequests.delete(target.key);
		}
	})();

	pendingRequests.set(target.key, request);
	return request;
}
