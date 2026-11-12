/**
 * 番剧收藏数据（本地数据源）。
 * 用于番剧页：src/pages/anime.astro → organisms/AnimeSection → molecules/AnimeCard。
 *
 * 添加条目：在 animeData 中追加一项即可，状态筛选 chips 与计数自动生成。
 * - cover 省略时卡片显示主题色渐变占位（补图前不破版）；
 * - link 省略时封面不可点；rating 为 0-10 个人评分；
 * - progress 是结构化追番进度，watching 状态在卡片上渲染进度条。
 * JSON 数据源（外部收藏服务拉取）见 utils/anime-data.ts 的 AnimeSource 分发。
 */

import type { AnimeIdentity } from "../types/animeConfig.ts";

/** 收藏状态（Bangumi 领域通行五态） */
export type AnimeStatus =
	| "watching"
	| "completed"
	| "planned"
	| "onHold"
	| "dropped";

export interface AnimeItem {
	title: string;
	/** 封面图地址（相对 /public 或绝对 URL）；省略 = 渐变占位 */
	cover?: string;
	/** 条目外链（Bangumi/官方站等）；省略则封面不可点 */
	link?: string;
	status: AnimeStatus;
	/** 个人评分 0-10 */
	rating: number;
	/** 追番进度：已看 / 总集数（未知时可选省略） */
	progress?: { watched: number; total: number };
	/** 一句话感想 */
	description?: string;
	/** 放送年份（展示用） */
	year: string;
	/** 制作公司 */
	studio?: string;
	/** 题材标签 */
	genres: string[];
	/** 观看时间段（年-月） */
	period?: { start: string; end: string };
	/** 条目来源身份标识（可选，用于跨源去重与归档） */
	identity?: AnimeIdentity;
}

export const animeData: AnimeItem[] = [
	{
		title: "罗小黑战记",
		cover: "/assets/anime/lxhzj-tv.webp",
		link: "https://www.bilibili.com/bangumi/play/ss1733",
		status: "completed",
		rating: 9.9,
		progress: { watched: 43, total: 43 },
		description: "猫妖小黑的日常冒险，治愈又热血的国创经典",
		year: "2011",
		studio: "寒木春华",
		genres: ["奇幻", "日常", "治愈"],
	},
	{
		title: "罗小黑战记（大电影）",
		cover: "/assets/anime/lxhzj-movie1.webp",
		link: "https://www.bilibili.com/bangumi/play/ss28198",
		status: "completed",
		rating: 9.6,
		progress: { watched: 1, total: 1 },
		description: "流浪猫妖与人类世界的温柔相遇",
		year: "2019",
		studio: "寒木春华",
		genres: ["奇幻", "冒险", "治愈"],
		period: { start: "2019-09", end: "2019-09" },
	},
	{
		title: "罗小黑战记2",
		cover: "/assets/anime/lxhzj-movie2.webp",
		link: "https://www.bilibili.com/bangumi/play/ep2243434",
		status: "completed",
		rating: 9.9,
		progress: { watched: 1, total: 1 },
		description: "小黑与师父的新旅程，妖灵会馆再起风波",
		year: "2025",
		studio: "寒木春华",
		genres: ["奇幻", "冒险", "治愈"],
		period: { start: "2025-07", end: "2025-07" },
	},
	{
		title: "葬送的芙莉莲",
		cover: "/assets/anime/frieren.webp",
		link: "https://www.bilibili.com/bangumi/play/ss46089",
		status: "completed",
		rating: 9.9,
		progress: { watched: 28, total: 28 },
		description: "千年精灵的旅途，在告别之后重新理解人类",
		year: "2023",
		studio: "MADHOUSE",
		genres: ["奇幻", "冒险", "治愈"],
		period: { start: "2023-09", end: "2024-03" },
	},
	{
		title: "葬送的芙莉莲 第二季",
		cover: "/assets/anime/frieren-s2.webp",
		link: "https://www.bilibili.tv/play/2287773/24662201",
		status: "completed",
		rating: 7.5,
		progress: { watched: 10, total: 10 },
		description: "旅途继续，芙莉莲一行向北方高原进发",
		year: "2026",
		studio: "MADHOUSE",
		genres: ["奇幻", "冒险", "治愈"],
		period: { start: "2026-01", end: "2026-03" },
	},
];
