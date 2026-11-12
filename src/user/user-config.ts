/**
 * 用户配置覆盖层（由 `pnpm content:sync` 生成，请勿手工编辑）。
 *
 * 内容来自内容仓的以下文件，改配置请改那边：
 * - config/site.yaml
 * - config/permalink.yaml
 * - config/profile.yaml
 * - config/license.yaml
 * - config/expressive-code.yaml
 * - config/announcement.yaml
 * - config/post-list.yaml
 * - config/article.yaml
 * - config/comment.yaml
 * - config/context-menu.yaml
 * - config/fab.yaml
 * - config/sidebar.yaml
 * - config/footer.yaml
 * - config/image-bloom.yaml
 * - config/skills.yaml
 * - config/projects.yaml
 * - config/timeline.yaml
 * - config/devices.yaml
 * - config/games.yaml
 * - config/music.yaml
 * - config/anime.yaml
 * - config/font.yaml
 * - config/llms.yaml
 * - config/umami.yaml
 * - config/series.yaml
 * - config/nav-bar.yaml
 *
 * 每个领域的类型标注让 `tsc` 直接校验用户配置：拼错的键、越界的枚举、填错的类型
 * 都会在这里报错，错误信息里的行号可以对回上面的 YAML 文件。
 */

import type { AnimeConfig } from "@/types/animeConfig";
import type { AnnouncementConfig } from "@/types/announcementConfig";
import type { ArticleConfig } from "@/types/articleConfig";
import type { CommentConfig } from "@/types/commentConfig";
import type { ExpressiveCodeConfig, LicenseConfig, ProfileConfig, SiteConfig } from "@/types/config";
import type { ContextMenuConfig } from "@/types/contextMenuConfig";
import type { DevicesConfig } from "@/types/devicesConfig";
import type { FabConfig } from "@/types/fabConfig";
import type { FontConfig } from "@/types/fontConfig";
import type { FooterConfig } from "@/types/footerConfig";
import type { GamesConfig } from "@/types/gamesConfig";
import type { ImageBloomConfig } from "@/types/imageBloomConfig";
import type { LlmsConfig } from "@/types/llmsConfig";
import type { MusicConfig } from "@/types/musicConfig";
import type { NavBarConfigOverride } from "@/types/navBarConfig";
import type { PermalinkConfig } from "@/types/permalinkConfig";
import type { PostListConfig } from "@/types/postListConfig";
import type { ProjectsConfig } from "@/types/projectsConfig";
import type { SeriesConfig } from "@/types/seriesConfig";
import type { SidebarConfig } from "@/types/sidebarConfig";
import type { SkillsConfig } from "@/types/skillsConfig";
import type { TimelineConfig } from "@/types/timelineConfig";
import type { UmamiConfig } from "@/types/umamiConfig";

/**
 * 用户只需要写想改的键，因此每个领域都按「深度可选」校验。
 *
 * 数组保持原类型不放宽：清单类配置（侧栏 widget、社交链接）的覆盖语义是整体替换，
 * 半个元素没有意义，而且保留完整类型才能让判别联合的 `type` 字段继续生效。
 */
type DeepPartial<T> = T extends readonly unknown[]
	? T
	: T extends object
		? { [K in keyof T]?: DeepPartial<T[K]> }
		: T;

// config/site.yaml
const site: DeepPartial<SiteConfig> = {
	site: "https://industry2419.com/",
	base: "/",
	title: "宫廷玉夜",
	subtitle: "A Material 3 anime blog",
	lang: "zh_CN",
	timeZone: "Asia/Shanghai",
	topAppBar: {
		contentAlign: "center",
	},
	displaySettings: {
		colorStyle: true,
		colorSpec: true,
		wallpaperMode: true,
		layoutMode: true,
		reduceMotion: true,
		texture: true,
	},
	themeColor: {
		hue: 25,
		fixed: false,
		style: "tonalSpot",
		spec: "2025",
		palette: "palace",
	},
	wallpaperMode: {
		defaultMode: "banner",
	},
	texture: {
		enable: true,
		defaultPreset: "palace",
		defaultOpacity: 0.12,
		allowMotion: true,
	},
	pageBackground: {
		enable: false,
		src: "",
		position: "center",
		opacity: 1,
		dim: {
			enable: true,
			opacity: 0.2,
		},
	},
	banner: {
		src: {
			desktop: [
				"assets/images/banner/desktop/1.webp",
			],
			mobile: [
				"assets/images/banner/mobile/1.webp",
			],
		},
		position: "center",
		dim: {
			enable: true,
			opacity: 0.24,
		},
		homeText: {
			enable: true,
			title: "宫廷玉夜",
			subtitle: [
				"特別なことはないけど、君がいると十分です",
				"今でもあなたは私の光",
				"君ってさ、知らないうちに私の毎日になってたよ",
				"君と話すと、なんか毎日がちょっと楽しくなるんだ",
				"今日はなんでもない日。でも、ちょっとだけいい日",
			],
			typewriter: {
				enable: true,
				speed: 100,
				deleteSpeed: 50,
				pauseTime: 2000,
				loop: true,
			},
		},
		carousel: {
			enable: true,
			interval: 6000,
			fadeDuration: 1200,
			animation: "ken-burns",
		},
		waves: {
			enable: true,
		},
	},
	imageOptimization: {
		noReferrerDomains: [
			"*.hdslb.com",
		],
	},
	toc: {
		enable: true,
		depth: 2,
	},
	progressIndicator: {
		style: "dual",
	},
	favicon: [],
};

// config/permalink.yaml
const permalink: DeepPartial<PermalinkConfig> = {
	enable: false,
	format: "%postname%",
};

// config/profile.yaml
const profile: DeepPartial<ProfileConfig> = {
	avatar: "assets/images/avatar.jpg",
	name: "宫夜",
	bio: "The rain remembers what the sky forgot to say.",
	links: [
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/industry2419",
		},
	],
};

// config/license.yaml
const license: DeepPartial<LicenseConfig> = {
	enable: true,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

// config/expressive-code.yaml
const expressiveCode: DeepPartial<ExpressiveCodeConfig> = {
	theme: "github-dark",
	lightTheme: "github-light",
	darkTheme: "github-dark",
};

// config/announcement.yaml
const announcement: DeepPartial<AnnouncementConfig> = {
	title: "",
	content: "The only way to do great work is to love what you do.",
	closable: true,
	link: {
		enable: true,
		text: "GitHub",
		url: "https://github.com",
		external: true,
	},
};

// config/post-list.yaml
const postList: DeepPartial<PostListConfig> = {
	pageSize: 8,
	layout: {
		mode: "list",
		cover: "right",
		cardWidth: "regular",
	},
};

// config/article.yaml
const article: DeepPartial<ArticleConfig> = {
	lastUpdated: {
		enable: true,
		minimumAgeDays: 90,
	},
	discovery: {
		enable: true,
		related: {
			enable: true,
			count: 3,
		},
		random: {
			enable: true,
			count: 2,
		},
	},
	share: {
		enable: true,
		includeCover: true,
	},
};

// config/comment.yaml
const comment: DeepPartial<CommentConfig> = {
	enable: true,
	provider: "giscus",
	lazy: true,
	twikoo: {
		envId: "",
		scriptUrl: "https://cdn.jsdelivr.net/npm/twikoo@1.7.20/dist/twikoo.min.js",
		lang: "auto",
		placeholder: "Share your thoughts...",
	},
	giscus: {
		repo: "industry2419/my-blog",
		repoId: "R_kgDOVi0_Rg",
		category: "Announcements",
		categoryId: "DIC_kwDOVi0_Rs4DK4WT",
		mapping: "pathname",
		strict: false,
		reactionsEnabled: true,
		emitMetadata: false,
		inputPosition: "bottom",
		theme: {
			light: "light",
			dark: "dark",
		},
		lang: "auto",
		scriptUrl: "https://giscus.app/client.js",
	},
	waline: {
		serverURL: "",
		scriptUrl: "https://cdn.jsdelivr.net/npm/@waline/client@3.16.1/dist/waline.umd.js",
		styleUrl: "https://cdn.jsdelivr.net/npm/@waline/client@3.16.1/dist/waline.css",
		lang: "auto",
		locale: {
			placeholder: "Share your thoughts...",
		},
		emoji: true,
		commentSorting: "latest",
		meta: [
			"nick",
			"mail",
			"link",
		],
		requiredMeta: [],
		login: "enable",
		wordLimit: 0,
		pageSize: 10,
		imageUploader: true,
		highlighter: true,
		texRenderer: false,
		noCopyright: false,
		noRss: true,
		recaptchaV3Key: "",
		turnstileKey: "",
		reaction: true,
	},
};

// config/context-menu.yaml
const contextMenu: DeepPartial<ContextMenuConfig> = {
	enable: true,
	actions: [
		"copySelection",
		"backToTop",
		"sharePageLink",
	],
};

// config/fab.yaml
const fab: DeepPartial<FabConfig> = {
	enable: true,
	align: "end",
	size: "regular",
	offset: {
		bottom: "var(--m3e-space-8)",
		right: "var(--m3e-space-6)",
	},
	items: [
		{
			type: "top",
			enable: true,
			devices: [
				"mobile",
				"tablet",
				"desktop",
			],
		},
		{
			type: "toc",
			enable: true,
			devices: [
				"mobile",
				"tablet",
			],
			pages: [
				"post",
			],
			depth: 3,
			closeOnSelect: true,
		},
		{
			type: "comment",
			enable: true,
			devices: [
				"mobile",
				"tablet",
			],
			pages: [
				"post",
			],
		},
		{
			type: "home",
			enable: true,
			devices: [
				"mobile",
				"tablet",
			],
			onlySubPages: true,
		},
	],
};

// config/sidebar.yaml
const sidebar: DeepPartial<SidebarConfig> = {
	enable: true,
	arrangement: "dual",
	side: "left",
	components: [
		{
			type: "profile",
			enable: true,
			slot: "top",
		},
		{
			type: "music",
			enable: true,
			slot: "top",
		},
		{
			type: "announcement",
			enable: true,
			slot: "top",
			pages: [
				"home",
			],
		},
		{
			type: "categories",
			enable: true,
			slot: "sticky",
			collapseAfter: 5,
		},
		{
			type: "tags",
			enable: true,
			slot: "sticky",
			collapseAfter: 6,
		},
		{
			type: "stats",
			enable: true,
			slot: "top",
			column: "secondary",
			pages: [
				"home",
				"archive",
				"categories",
				"tags",
			],
		},
		{
			type: "calendar",
			enable: true,
			slot: "top",
			column: "secondary",
		},
		{
			type: "toc",
			enable: true,
			slot: "sticky",
			column: "secondary",
			pages: [
				"post",
			],
		},
	],
};

// config/footer.yaml
const footer: DeepPartial<FooterConfig> = {
	enable: false,
};

// config/image-bloom.yaml
const imageBloom: DeepPartial<ImageBloomConfig> = {
	enable: true,
	blurRadius: 20,
	opacity: 0.7,
	transitionDuration: 300,
};

// config/skills.yaml
const skills: DeepPartial<SkillsConfig> = {
	enable: true,
	categories: [
		{
			key: "frontend",
			label: "前端",
			icon: "material-symbols:web-rounded",
		},
		{
			key: "backend",
			label: "后端",
			icon: "material-symbols:dns-rounded",
		},
		{
			key: "tooling",
			label: "工具",
			icon: "material-symbols:construction-rounded",
		},
		{
			key: "game",
			label: "游戏开发",
			icon: "material-symbols:sports-esports-rounded",
		},
	],
};

// config/projects.yaml
const projects: DeepPartial<ProjectsConfig> = {
	enable: true,
	categories: [
		{
			key: "theme",
			label: "主题",
			icon: "material-symbols:palette-outline-rounded",
		},
		{
			key: "app",
			label: "应用",
			icon: "material-symbols:apps-rounded",
		},
		{
			key: "tool",
			label: "工具",
			icon: "material-symbols:build-outline-rounded",
		},
	],
};

// config/timeline.yaml
const timeline: DeepPartial<TimelineConfig> = {
	enable: true,
	categories: [
		{
			key: "milestone",
			label: "里程碑",
			icon: "material-symbols:flag-rounded",
		},
		{
			key: "project",
			label: "项目",
			icon: "material-symbols:code-rounded",
		},
		{
			key: "career",
			label: "经历",
			icon: "material-symbols:work-rounded",
		},
		{
			key: "life",
			label: "生活",
			icon: "material-symbols:favorite-rounded",
		},
	],
	order: "desc",
};

// config/devices.yaml
const devices: DeepPartial<DevicesConfig> = {
	enable: true,
	categories: [
		{
			key: "desk",
			label: "桌面工作站",
			icon: "material-symbols:desktop-windows-outline-rounded",
			description: "生产力与开发主力工作台",
		},
		{
			key: "mobile",
			label: "移动便携",
			icon: "material-symbols:phone-iphone",
			description: "随身电子设备与便携数码",
		},
		{
			key: "audio",
			label: "影音音频",
			icon: "material-symbols:headphones-rounded",
			description: "耳机、音响与音频器材",
		},
		{
			key: "peripheral",
			label: "外设配件",
			icon: "material-symbols:keyboard-outline-rounded",
			description: "键盘、鼠标与桌面配件",
		},
	],
};

// config/games.yaml
const games: DeepPartial<GamesConfig> = {
	enable: true,
	categories: [
		{
			key: "open-world",
			label: "开放世界",
			icon: "material-symbols:explore-outline-rounded",
			description: "广袤世界的探索与冒险",
		},
		{
			key: "sandbox",
			label: "沙盒建造",
			icon: "material-symbols:widgets-rounded",
			description: "自由建造与生存创造",
		},
		{
			key: "rpg",
			label: "角色扮演",
			icon: "material-symbols:shield-outline-rounded",
			description: "剧情驱动的角色扮演",
		},
		{
			key: "action",
			label: "动作格斗",
			icon: "material-symbols:swords-outline-rounded",
			description: "动作、射击与格斗",
		},
		{
			key: "casual",
			label: "休闲派对",
			icon: "material-symbols:extension-outline-rounded",
			description: "轻松休闲与聚会游戏",
		},
	],
	source: {
		kind: "snapshot",
		provider: "enka",
		file: "enka.json",
	},
	fallback: {
		kind: "local",
	},
	providers: {
		enka: {
			enable: true,
			request: {
				minDelayMs: 600,
				timeoutMs: 20000,
			},
			games: [
				{
					gameId: "genshin-impact",
					provider: "genshin",
					uid: "238563185",
				},
				{
					gameId: "honkai-star-rail",
					provider: "starrail",
					uid: "116319739",
				},
				{
					gameId: "zenless-zone-zero",
					provider: "zenless",
					uid: "29161154",
				},
			],
		},
	},
	snapshot: {
		directory: "src/data/games-snapshots",
		staleAfterDays: 30,
		keepLastValid: true,
	},
};

// config/music.yaml
const music: DeepPartial<MusicConfig> = {
	enable: true,
	provider: "mixed",
	defaultVolume: 0.7,
	defaultMode: "sequence",
	meting: {
		server: "netease",
		type: "playlist",
		id: "14164869977",
	},
};

// config/anime.yaml
const anime: DeepPartial<AnimeConfig> = {
	enable: true,
	source: {
		kind: "snapshot",
		provider: "bangumi",
		file: "bangumi.json",
		fetchOnDev: false,
	},
	fallback: {
		kind: "local",
	},
	providers: {
		bangumi: {
			enable: true,
			userId: "industry2419",
			cover: {
				mode: "local",
			},
			request: {
				pageSize: 30,
				maxItems: 300,
				minDelayMs: 300,
			},
		},
		bilibili: {
			enable: false,
			vmid: "",
			sessdataEnv: "BILI_SESSDATA",
			cover: {
				mode: "local",
				mirror: "",
				useWebp: true,
			},
			request: {
				pageSize: 30,
				maxItems: 300,
				minDelayMs: 300,
			},
		},
	},
	snapshot: {
		directory: "src/data/anime-snapshots",
		staleAfterDays: 30,
		keepLastValid: true,
	},
};

// config/font.yaml
const font: DeepPartial<FontConfig> = {
	mode: "custom",
	fontFamilies: [
		{
			id: "outfit-body",
			family: "Outfit",
			role: "body",
			source: "local",
			variants: [
				{
					file: "src/assets/fonts/outfit-latin-400-normal.woff2",
					weight: 400,
					style: "normal",
				},
				{
					file: "src/assets/fonts/outfit-latin-500-normal.woff2",
					weight: 500,
					style: "normal",
				},
				{
					file: "src/assets/fonts/outfit-latin-700-normal.woff2",
					weight: 700,
					style: "normal",
				},
			],
			fallback: [
				"ui-sans-serif",
				"system-ui",
				"sans-serif",
			],
			display: "swap",
			preload: false,
		},
		{
			id: "yozai-cjk",
			family: "Yozai Medium",
			role: "cjk",
			source: "local",
			variants: [
				{
					file: "src/assets/fonts/Yozai-Medium.ttf",
					weight: 500,
					style: "normal",
				},
			],
			fallback: [
				"system-ui",
				"sans-serif",
			],
			display: "swap",
			preload: false,
		},
		{
			id: "jetbrains-mono",
			family: "JetBrains Mono",
			role: "mono",
			source: "local",
			variants: [
				{
					file: "src/assets/fonts/jetbrains-mono-latin-wght-normal.woff2",
					weight: "100 800",
					style: "normal",
				},
				{
					file: "src/assets/fonts/jetbrains-mono-latin-wght-italic.woff2",
					weight: "100 800",
					style: "italic",
				},
			],
			fallback: [
				"ui-monospace",
				"monospace",
			],
			display: "swap",
			preload: false,
		},
	],
};

// config/llms.yaml
const llms: DeepPartial<LlmsConfig> = {
	enable: true,
	generateFull: true,
};

// config/umami.yaml
const umami: DeepPartial<UmamiConfig> = {
	enable: false,
	shareUrl: "",
};

// config/series.yaml
const series: DeepPartial<SeriesConfig> = {
	enable: true,
	title: "$t:series",
	description: "",
	cardPosition: "bottom",
};

// config/nav-bar.yaml
const navBar: NavBarConfigOverride = {
	links: [
		{
			preset: "Home",
		},
		{
			preset: "Archive",
		},
		{
			name: "链接",
			icon: "material-symbols:link-rounded",
			children: [
				{
					preset: "Friends",
				},
				{
					preset: "Compass",
				},
			],
		},
		{
			name: "我的",
			icon: "material-symbols:person-outline-rounded",
			children: [
				{
					preset: "Moments",
				},
				{
					preset: "Anime",
				},
				{
					preset: "Games",
				},
				{
					name: "推荐",
					icon: "material-symbols:thumb-up-outline-rounded",
					url: "/recommend/",
				},
				{
					preset: "Albums",
				},
			],
		},
		{
			name: "关于",
			icon: "material-symbols:info-outline-rounded",
			children: [
				{
					preset: "About",
				},
				{
					preset: "Skills",
				},
				{
					preset: "Projects",
				},
				{
					preset: "Devices",
				},
				{
					preset: "Timeline",
				},
			],
		},
		{
			name: "更多",
			icon: "material-symbols:more-horiz",
			children: [
				{
					preset: "Categories",
				},
				{
					preset: "Tags",
				},
				{
					name: "GitHub",
					url: "https://github.com/industry2419",
					icon: "fa7-brands:github",
					external: true,
				},
			],
		},
	],
};

/** 领域名 -> 该领域的用户覆盖值（仅包含用户显式声明的键）。 */
export const userConfigOverrides: Readonly<Record<string, unknown>> = {
	site,
	permalink,
	profile,
	license,
	expressiveCode,
	announcement,
	postList,
	article,
	comment,
	contextMenu,
	fab,
	sidebar,
	footer,
	imageBloom,
	skills,
	projects,
	timeline,
	devices,
	games,
	music,
	anime,
	font,
	llms,
	umami,
	series,
	navBar,
};

/** 本次生成消费了内容仓中的哪些文件，用于溯源与错误提示。 */
export const userConfigSources: readonly string[] = [
	"config/site.yaml",
	"config/permalink.yaml",
	"config/profile.yaml",
	"config/license.yaml",
	"config/expressive-code.yaml",
	"config/announcement.yaml",
	"config/post-list.yaml",
	"config/article.yaml",
	"config/comment.yaml",
	"config/context-menu.yaml",
	"config/fab.yaml",
	"config/sidebar.yaml",
	"config/footer.yaml",
	"config/image-bloom.yaml",
	"config/skills.yaml",
	"config/projects.yaml",
	"config/timeline.yaml",
	"config/devices.yaml",
	"config/games.yaml",
	"config/music.yaml",
	"config/anime.yaml",
	"config/font.yaml",
	"config/llms.yaml",
	"config/umami.yaml",
	"config/series.yaml",
	"config/nav-bar.yaml",
];
