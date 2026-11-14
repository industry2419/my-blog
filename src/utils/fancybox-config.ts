/**
 * Fancybox 配置模块
 * 提供图片灯箱的选择器和默认选项
 */

import type { FancyboxOptions } from "@fancyapps/ui";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

// Fancybox 配置类型
export type FancyboxConfig = Partial<FancyboxOptions>;

/**
 * 灯箱工具栏与键盘提示的本地化文案。
 * 只覆盖页面实际出现的条目，其余键由 Fancybox 内置英文兜底。
 */
const getLightboxL10n = (): Record<string, string> => ({
	CLOSE: i18n(I18nKey.close),
	PREV: i18n(I18nKey.previousImage),
	NEXT: i18n(I18nKey.nextImage),
	ZOOM_IN: i18n(I18nKey.lightboxZoomIn),
	ZOOM_OUT: i18n(I18nKey.lightboxZoomOut),
	TOGGLE_FULL: i18n(I18nKey.lightboxToggleZoom),
	ROTATE_CCW: i18n(I18nKey.lightboxRotateCCW),
	ROTATE_CW: i18n(I18nKey.lightboxRotateCW),
	FLIP_X: i18n(I18nKey.lightboxFlipX),
	FLIP_Y: i18n(I18nKey.lightboxFlipY),
	RESET: i18n(I18nKey.lightboxReset),
	TOGGLE_AUTOPLAY: i18n(I18nKey.lightboxAutoplay),
	TOGGLE_FULLSCREEN: i18n(I18nKey.lightboxFullscreen),
	TOGGLE_THUMBS: i18n(I18nKey.lightboxThumbs),
});

// 默认 Fancybox 配置
export const getDefaultFancyboxConfig = (): FancyboxConfig => ({
	l10n: getLightboxL10n(),
	Carousel: {
		infinite: true,
		Lazyload: { preload: 3 },
		Thumbs: { showOnStart: true },
		Toolbar: {
			display: {
				left: ["counter"],
				middle: [
					"zoomIn",
					"zoomOut",
					"toggle1to1",
					"rotateCCW",
					"rotateCW",
					"flipX",
					"flipY",
					"reset",
				],
				right: ["autoplay", "fullscreen", "thumbs", "close"],
			},
		},
		Zoomable: {
			Panzoom: { maxScale: 3, minScale: 1 },
		},
	},
	dragToClose: true,
	keyboard: {
		Escape: "close",
		Delete: "close",
		Backspace: "close",
		PageUp: "next",
		PageDown: "prev",
		ArrowUp: "next",
		ArrowDown: "prev",
		ArrowRight: "next",
		ArrowLeft: "prev",
	},
});

// Fancybox 选择器
export const FANCYBOX_SELECTORS = {
	// 文章正文图片和封面图（排除画廊内图片，避免被整篇轮播组重复捕获）
	articleImages: ".custom-md img:not(.image-grid img), #post-cover img",

	// 画廊网格内带独立分组 ID 的链接（按 data-fancybox 值分组轮播）
	imageGrids: ".image-grid [data-fancybox]",

	// 带 data-fancybox 属性的其他元素（排除画廊链接，防止双绑）
	singleFancybox: "[data-fancybox]:not(.image-grid [data-fancybox])",
} as const;
