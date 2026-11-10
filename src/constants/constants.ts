export type ThemeMode = "light" | "dark" | "auto";

export const LIGHT_MODE = "light",
	DARK_MODE = "dark",
	AUTO_MODE = "auto";
/** 首次访问的默认明暗模式：站点默认暗色，访客选择会写入 localStorage 覆盖它 */
export const DEFAULT_THEME: ThemeMode = DARK_MODE;
export const THEME_CHANGE_EVENT: string = "shirone:theme-change";

export const WALLPAPER_MODE_KEY = "wallpaper-mode";
export const WALLPAPER_MODE_CHANGE_EVENT = "wallpaper-mode:change";
export const WALLPAPER_MODE_OPTIONS = ["none", "banner"] as const;

export const TEXTURE_PRESET_KEY = "texture-preset";
export const TEXTURE_OPACITY_KEY = "texture-opacity";
export const TEXTURE_CHANGE_EVENT = "texture:change";
export const TEXTURE_PRESETS = [
	"none",
	"starlight",
	"cyber-dots",
	"topography",
	"geometric",
	"sakura",
	"palace",
] as const;

// Banner height unit: vh
export const BANNER_HEIGHT = 35;
export const BANNER_HEIGHT_EXTEND = 30;
export const BANNER_HEIGHT_HOME: number = BANNER_HEIGHT + BANNER_HEIGHT_EXTEND;

// The height the main panel overlaps the banner, unit: rem
// Keep a small overlap so the content frame meets the wave edge naturally.
export const MAIN_PANEL_OVERLAPS_BANNER_HEIGHT = 1;

// Page width: rem. Single sidebar uses PAGE_WIDTH; dual-column
// arrangement widens the frame one tier (resolved in responsive-utils).
export const PAGE_WIDTH = 85;
export const PAGE_WIDTH_DUAL = 96;
