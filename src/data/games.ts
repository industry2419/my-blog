/**
 * 游戏展示页数据源
 * 行为与分类规则由 config/games.yaml 控制
 */

export type GameStatus = "playing" | "completed" | "backlog" | "wishlist";

export interface GameItem {
	enable?: boolean;
	id: string;
	name: string;
	developer: string;
	category: string;
	status: GameStatus;
	/** 横屏封面（建议 16:9 或更宽）：
	 *  - 省略时回退渲染 icon 图标卡片；
	 *  - 支持内容仓 assets/ 相对路径（参与构建期压缩转码）、
	 *    /public 绝对路径与远程 URL 三种写法。 */
	cover?: string;
	icon?: string;
	rating?: number;
	hours?: number;
	platform?: string;
	year?: string;
	tags?: string[];
	description: string;
	link?: string;
	featured?: boolean;
	/** 手填资历数据（快照缺失或未启用同步时的兜底；由游戏页构建期读取）。 */
	credential?: {
		level?: number;
		levelLabel?: string;
		achievements?: { done: number; total?: number };
		exploration?: { label: string; percent: number }[];
		challenge?: {
			label: string;
			value: number;
			max?: number;
			unit?: string;
			season?: string;
		};
		extra?: { key: string; label?: string; value: number | string }[];
	};
}

export const gamesData: GameItem[] = [
	{
		id: "genshin-impact",
		name: "原神",
		developer: "miHoYo",
		category: "rpg",
		status: "playing",
		cover: "/images/games/genshin-impact.webp",
		icon: "material-symbols:explore-outline-rounded",
		platform: "PC / 移动端",
		year: "2020",
		tags: ["Open World", "Action RPG", "Gacha"],
		description:
			"开放世界冒险 RPG。在提瓦特大陆探索七国、结识同伴，追寻失散的血亲与世界的真相。",
		link: "https://ys.mihoyo.com/",
	},
	{
		id: "honkai-star-rail",
		name: "崩坏：星穹铁道",
		developer: "miHoYo",
		category: "rpg",
		status: "playing",
		cover: "/images/games/honkai-star-rail.webp",
		icon: "material-symbols:rocket-launch-outline-rounded",
		platform: "PC / 移动端",
		year: "2023",
		tags: ["Turn-Based", "Space Fantasy", "Gacha"],
		description:
			"银河冒险策略 RPG。登上星穹列车，沿着开拓之路穿越不同世界，见证星神与命途的故事。",
		link: "https://sr.mihoyo.com/",
	},
	{
		id: "zenless-zone-zero",
		name: "绝区零",
		developer: "miHoYo",
		category: "action",
		status: "playing",
		cover: "/images/games/zenless-zone-zero.webp",
		icon: "material-symbols:swords-outline-rounded",
		platform: "PC / 移动端",
		year: "2024",
		tags: ["Action", "Urban", "Gacha"],
		description:
			"都市动作 RPG。作为绳匠带领代理人们深入空洞，在高速战斗与都市日常之间穿梭。",
		link: "https://zzz.mihoyo.com/",
	},
];
