export type PlaybackMode = "sequence" | "repeat-one" | "shuffle";

export type MusicProvider = "local" | "meting" | "custom" | "mixed";

export type MetingServer = "netease" | "tencent" | "kugou" | "xiami" | "baidu";

export type MetingType = "playlist" | "song" | "album" | "artist";

export type MusicErrorCode =
	| "empty-playlist"
	| "source-unavailable"
	| "autoplay-blocked"
	| "invalid-track";

export type MusicStatus =
	| "idle"
	| "loading"
	| "ready"
	| "playing"
	| "paused"
	| "error";

/** 音乐播放器（侧边栏完整版与胶囊版）共用的本地化标签。 */
export interface MusicPlayerLabels {
	readonly title: string;
	readonly previous: string;
	readonly play: string;
	readonly pause: string;
	readonly next: string;
	readonly mute: string;
	readonly unmute: string;
	readonly playbackMode: string;
	readonly modeSequence: string;
	readonly modeRepeatOne: string;
	readonly modeShuffle: string;
	readonly progress: string;
	readonly volume: string;
	readonly showPlaylist: string;
	readonly hidePlaylist: string;
	readonly empty: string;
	readonly loading: string;
	readonly notRequested: string;
	readonly nowPlaying: string;
	readonly close: string;
	readonly lyrics: string;
	readonly lyricsLoading: string;
	readonly lyricsEmpty: string;
	readonly removeTrack: string;
	readonly restoreTracks: string;
	readonly errors: Readonly<Record<MusicErrorCode, string>>;
}

export interface TrackDescriptor {
	readonly id: string;
	readonly title: string;
	readonly artist?: string;
	readonly source: string;
	readonly cover?: string;
	/** 本地曲目的 LRC 歌词地址；远程 Meting 曲目通过歌曲 ID 请求，不填此项。 */
	readonly lrc?: string;
	/** 构建期生成的封面候选；远程 Meting 曲目保持为空。 */
	readonly coverSrcset?: string;
	readonly coverSizes?: string;
	readonly coverWidth?: number;
	readonly coverHeight?: number;
	readonly duration?: number;
}

export type MetingPreloadMode = "metadata" | "none";

export interface MetingMusicConfig {
	/** 音乐平台，默认 netease（网易云音乐） */
	readonly server?: MetingServer;
	/** 资源类型，默认 playlist（歌单） */
	readonly type?: MetingType;
	/** 歌单 / 单曲 / 专辑 ID */
	readonly id?: string;
	/** Meting API 地址模板，默认使用公开 API */
	readonly api?: string;
	/**
	 * 是否在音乐组件进入视口时预取歌单元数据：
	 * - "metadata"：进入视口即请求一次歌单，**仅取元信息**（曲名/歌手/封面，不预取音频流），
	 *   返回后卡片直接显示第一首曲目；
	 * - "none"（默认）：不预取，等用户播放/展开播放列表时才请求（卡片显示「尚未请求」占位）。
	 */
	readonly preload?: MetingPreloadMode;
}

export interface MusicConfig {
	/** 是否全局启用音乐功能 */
	readonly enable: boolean;
	/** 音频数据源模式：local（本地曲目） | meting（Meting 远端歌单） | custom（显式传入 tracks） | mixed（本地与远端歌单合并） */
	readonly provider?: MusicProvider;
	/** 本地播放列表（provider 为 local, custom, mixed 时生效；未填时默认读取 src/data/music.ts） */
	readonly tracks?: readonly TrackDescriptor[];
	/** Meting API 配置（provider 为 meting 或 mixed 时生效） */
	readonly meting?: MetingMusicConfig;
	/** 初始音量，范围 0–1 */
	readonly defaultVolume: number;
	/** 初始播放模式 */
	readonly defaultMode: PlaybackMode;
}

export interface MusicSnapshot {
	readonly playlist: readonly TrackDescriptor[];
	readonly currentIndex: number;
	readonly currentTrack: TrackDescriptor | null;
	readonly status: MusicStatus;
	readonly currentTime: number;
	readonly duration: number;
	readonly volume: number;
	readonly muted: boolean;
	readonly mode: PlaybackMode;
	readonly error: MusicErrorCode | null;
	/** 当前会话中被访客临时剔除的曲目数量（不改变底层歌单）。 */
	readonly excludedCount: number;
}

export interface MusicRuntime {
	initialize(): Promise<void>;
	getSnapshot(): MusicSnapshot;
	subscribe(listener: (snapshot: MusicSnapshot) => void): () => void;
	play(): Promise<void>;
	pause(): void;
	toggle(): Promise<void>;
	select(index: number): Promise<void>;
	next(): Promise<void>;
	previous(): Promise<void>;
	seek(seconds: number): void;
	setVolume(value: number): void;
	setMuted(value: boolean): void;
	setMode(mode: PlaybackMode): void;
	/** 本次会话内临时剔除一首歌（sessionStorage 持久化，刷新后仍在，关闭会话即恢复）。 */
	removeTrack(id: string): void;
	/** 撤销本次会话的全部剔除。 */
	restoreTracks(): void;
	destroy(): void;
}
