import type {
	MetingMusicConfig,
	TrackDescriptor,
} from "../../types/musicConfig.ts";

export const DEFAULT_METING_API =
	"https://api.injahow.cn/meting/?server=:server&type=:type&id=:id&r=:r";
export const DEFAULT_METING_SERVER = "netease";
export const DEFAULT_METING_TYPE = "playlist";

export interface RawMetingSong {
	id?: number | string;
	name?: string;
	title?: string;
	artist?: string;
	author?: string;
	duration?: number | string;
	pic?: string;
	url?: string;
	lrc?: string;
}

/**
 * 按指定 type / id 组装 Meting 请求 URL。
 * 歌单、歌词等请求共用同一套模板替换，避免两处拼装规则漂移。
 */
export function buildMetingApiUrl(
	config: MetingMusicConfig,
	type: string,
	id: string,
): string | null {
	const trimmedId = id.trim();
	if (!trimmedId) return null;

	const api = config.api?.trim() || DEFAULT_METING_API;
	const server = config.server?.trim() || DEFAULT_METING_SERVER;
	const random = Date.now().toString();

	return api
		.replace(":server", encodeURIComponent(server))
		.replace(":type", encodeURIComponent(type))
		.replace(":id", encodeURIComponent(trimmedId))
		.replace(":auth", "")
		.replace(":r", random);
}

/**
 * 根据 Meting 配置组装请求 URL。若 ID 为空则返回 null。
 */
export function buildMetingUrl(config: MetingMusicConfig): string | null {
	const id = config.id?.trim();
	if (!id) return null;
	return buildMetingApiUrl(
		config,
		config.type?.trim() || DEFAULT_METING_TYPE,
		id,
	);
}

/**
 * 从 `meting-<server>-<songId>` 形式的曲目 ID 中取回平台原始歌曲 ID。
 * 本地曲目或格式不匹配时返回 null。
 */
export function parseMetingTrackId(
	trackId: string,
	server: string = DEFAULT_METING_SERVER,
): string | null {
	const prefix = `meting-${server}-`;
	if (!trackId.startsWith(prefix)) return null;
	const id = trackId.slice(prefix.length);
	return id ? id : null;
}

/** 组装单曲歌词（LRC）请求 URL。 */
export function buildMetingLrcUrl(
	config: MetingMusicConfig,
	songId: string,
): string | null {
	return buildMetingApiUrl(config, "lrc", songId);
}

/**
 * 从 Meting 返回的播放/歌词地址中提取平台歌曲 ID。
 * 部分公开实例的曲目对象不回传 `id` 字段，只在 `url` / `lrc` 中带 `id` 查询参数，
 * 缺少该 ID 会导致歌词请求无法组装。
 */
function extractSongIdFromUrl(raw: string | undefined): string | null {
	const value = raw?.trim();
	if (!value) return null;
	try {
		const id = new URL(value, "https://meting.invalid").searchParams
			.get("id")
			?.trim();
		if (id && /^[A-Za-z0-9_-]+$/.test(id)) return id;
	} catch {
		// 非法地址直接忽略，继续回退到随机 ID。
	}
	return null;
}

/**
 * 将 Meting API 单曲响应清洗并转换为标准的 TrackDescriptor。
 */
export function parseMetingSong(
	song: RawMetingSong,
	index: number,
	server: string = DEFAULT_METING_SERVER,
): TrackDescriptor | null {
	if (!song || typeof song !== "object") return null;

	const title = (song.name ?? song.title ?? "").trim();
	const source = (song.url ?? "").trim();
	if (!title || !source) return null;

	const explicitId =
		song.id !== undefined && song.id !== null && String(song.id).trim() !== ""
			? String(song.id).trim()
			: null;
	const songId =
		explicitId ??
		extractSongIdFromUrl(source) ??
		extractSongIdFromUrl(song.lrc);
	const id = songId
		? `meting-${server}-${songId}`
		: `meting-${server}-${index}-${Math.random().toString(36).slice(2, 8)}`;

	const artist = (song.artist ?? song.author ?? "").trim() || undefined;
	const cover = (song.pic ?? "").trim() || undefined;

	let duration: number | undefined;
	if (typeof song.duration === "number" && Number.isFinite(song.duration)) {
		duration =
			song.duration > 10000
				? Math.floor(song.duration / 1000)
				: Math.floor(song.duration);
	} else if (typeof song.duration === "string") {
		const parsed = Number.parseInt(song.duration, 10);
		if (Number.isFinite(parsed) && parsed > 0) {
			duration = parsed > 10000 ? Math.floor(parsed / 1000) : parsed;
		}
	}
	if (duration !== undefined && duration <= 0) {
		duration = undefined;
	}

	return Object.freeze({
		id,
		title,
		source,
		artist,
		cover,
		duration,
	});
}

/**
 * 从 Meting API 异步获取并解析曲目列表。
 */
export async function fetchMetingTracks(
	config: MetingMusicConfig,
	customFetch: typeof fetch = fetch,
): Promise<readonly TrackDescriptor[]> {
	const url = buildMetingUrl(config);
	if (!url) return [];

	const response = await customFetch(url);
	if (!response.ok) {
		throw new Error(`Meting API HTTP ${response.status}`);
	}

	const data = (await response.json()) as RawMetingSong[];
	if (!Array.isArray(data)) return [];

	const server = config.server || DEFAULT_METING_SERVER;
	const tracks: TrackDescriptor[] = [];
	const seenIds = new Set<string>();

	for (let i = 0; i < data.length; i++) {
		const track = parseMetingSong(data[i], i, server);
		if (track && !seenIds.has(track.id)) {
			seenIds.add(track.id);
			tracks.push(track);
		}
	}

	return Object.freeze(tracks);
}
