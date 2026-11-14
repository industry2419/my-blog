/**
 * 侧栏音乐播放器本地曲目数据源
 * 用于 music.yaml 中的 local 与 mixed 模式
 */

export interface TrackDescriptor {
	id: string;
	title: string;
	artist?: string;
	cover?: string;
	source: string;
	/** 本地曲目的 LRC 歌词地址；留空时回退到 Meting 歌曲 ID。 */
	lrc?: string;
	duration?: number;
}

export const musicTracks: readonly TrackDescriptor[] = [
	{
		id: "sample-track-1",
		title: "口笛で愛は歌えない",
		artist: "Dazbee",
		cover: "assets/images/music/dazbee.webp",
		source: "/assets/music/url/dazbee.mp3",
		lrc: "/assets/music/lyrics/dazbee.lrc",
		duration: 241,
	},
];
