import type { GameStatus } from "../../types/gamesConfig.ts";
import I18nKey from "../../i18n/i18nKey.ts";

/** 状态呈现元数据：文案键 / 图标 / M3E tonal 配对（叠在封面上保证对比度） */
export const GAME_STATUS_META: Record<
	GameStatus,
	{ key: I18nKey; icon: string; bg: string; fg: string }
> = {
	playing: {
		key: I18nKey.gamesStatusPlaying,
		icon: "material-symbols:play-circle-outline-rounded",
		bg: "var(--primary)",
		fg: "var(--on-primary)",
	},
	completed: {
		key: I18nKey.gamesStatusCompleted,
		icon: "material-symbols:trophy-outline-rounded",
		bg: "var(--tertiary)",
		fg: "var(--on-tertiary)",
	},
	backlog: {
		key: I18nKey.gamesStatusBacklog,
		icon: "material-symbols:hourglass-empty-rounded",
		bg: "var(--surface-container-highest)",
		fg: "var(--on-surface-variant)",
	},
	wishlist: {
		key: I18nKey.gamesStatusWishlist,
		icon: "material-symbols:bookmark-outline-rounded",
		bg: "var(--secondary)",
		fg: "var(--on-secondary)",
	},
	quit: {
		key: I18nKey.gamesStatusQuit,
		icon: "material-symbols:logout-rounded",
		bg: "var(--error-container)",
		fg: "var(--on-error-container)",
	},
};
