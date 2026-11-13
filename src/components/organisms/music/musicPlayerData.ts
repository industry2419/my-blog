import { getImage } from "astro:assets";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { resolveImageAsset } from "@utils/asset-utils";
import type { ResolvedMusicOptions } from "@/config/musicConfig";
import { musicConfig, resolveMusicOptions } from "@/config/musicConfig";
import { musicTracks } from "@/data/music";
import type { MusicPlayerLabels } from "@/types/musicConfig";

export interface MusicPlayerData {
	options: ResolvedMusicOptions;
	labels: MusicPlayerLabels;
}

/**
 * 解析音乐播放器所需的配置、优化后的封面与本地化标签。
 * 侧边栏完整版与胶囊版共用，避免两套构建期数据出现偏差。
 * 音乐未启用时返回 null，调用方不输出任何 DOM 或客户端脚本。
 */
export async function resolveMusicPlayerData(): Promise<MusicPlayerData | null> {
	const options = resolveMusicOptions(musicConfig);
	if (!options) return null;

	const configuredTracks =
		musicConfig.tracks ??
		(musicConfig.provider === "local" || musicConfig.provider === "mixed"
			? musicTracks
			: []);
	const configuredCovers = new Map(
		configuredTracks.map((track) => [track.id.trim(), track.cover] as const),
	);

	const optimizedOptions: ResolvedMusicOptions = {
		...options,
		playlist: await Promise.all(
			options.playlist.map(async (track) => {
				const configuredCover = configuredCovers.get(track.id) ?? track.cover;
				if (!configuredCover) return track;
				const asset = await resolveImageAsset(configuredCover);
				if (typeof asset === "string") return track;
				const widths = [64, 128].filter((width) => width <= asset.width);
				if (!widths.length) widths.push(asset.width);
				const candidates = await Promise.all(
					widths.map(async (width) => ({
						width,
						image: await getImage({
							src: asset,
							width,
							format: "webp",
							quality: 68,
						}),
					})),
				);
				return {
					...track,
					cover: candidates.at(-1)?.image.src ?? asset.src,
					coverSrcset: candidates
						.map(({ image, width }) => `${image.src} ${width}w`)
						.join(", "),
					coverSizes: "52px",
					coverWidth: asset.width,
					coverHeight: asset.height,
				};
			}),
		),
	};

	return {
		options: optimizedOptions,
		labels: {
			title: i18n(I18nKey.musicPlayerTitle),
			previous: i18n(I18nKey.musicPrevious),
			play: i18n(I18nKey.musicPlay),
			pause: i18n(I18nKey.musicPause),
			next: i18n(I18nKey.musicNext),
			mute: i18n(I18nKey.musicMute),
			unmute: i18n(I18nKey.musicUnmute),
			playbackMode: i18n(I18nKey.musicPlaybackMode),
			modeSequence: i18n(I18nKey.musicModeSequence),
			modeRepeatOne: i18n(I18nKey.musicModeRepeatOne),
			modeShuffle: i18n(I18nKey.musicModeShuffle),
			progress: i18n(I18nKey.musicProgress),
			volume: i18n(I18nKey.musicVolume),
			showPlaylist: i18n(I18nKey.musicShowPlaylist),
			hidePlaylist: i18n(I18nKey.musicHidePlaylist),
			empty: i18n(I18nKey.musicEmpty),
			loading: i18n(I18nKey.musicLoading),
			notRequested: i18n(I18nKey.musicNotRequested),
			nowPlaying: i18n(I18nKey.musicNowPlaying),
			close: i18n(I18nKey.close),
			lyrics: i18n(I18nKey.musicLyrics),
			lyricsLoading: i18n(I18nKey.musicLyricsLoading),
			lyricsEmpty: i18n(I18nKey.musicLyricsEmpty),
			removeTrack: i18n(I18nKey.musicRemoveTrack),
			restoreTracks: i18n(I18nKey.musicRestoreTracks),
			errors: {
				"empty-playlist": i18n(I18nKey.musicErrorEmptyPlaylist),
				"source-unavailable": i18n(I18nKey.musicErrorSourceUnavailable),
				"autoplay-blocked": i18n(I18nKey.musicErrorAutoplayBlocked),
				"invalid-track": i18n(I18nKey.musicErrorInvalidTrack),
			},
		},
	};
}
