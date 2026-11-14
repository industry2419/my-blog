import type {
	AlbumPreviewConfig,
	AlbumsConfig,
} from "../types/albumsConfig.ts";
import { withUserConfig } from "../utils/config-overlay.ts";

const PREVIEW_DEFAULTS: Required<AlbumPreviewConfig> = {
	enable: true,
	photoWidth: 960,
	photoQuality: 68,
	coverWidth: 1200,
	coverQuality: 72,
};

export const albumsConfig: AlbumsConfig = withUserConfig("albums", {
	enable: true,
	title: "$t:albums",
	description: "$t:albumsBanner",
	preview: PREVIEW_DEFAULTS,
});

function clampNumber(
	value: unknown,
	min: number,
	max: number,
	fallback: number,
): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * 把用户配置解析成生成器可直接消费的完整参数。缺省字段逐项回退，
 * 数值越界时钳制，避免异常的宽度或质量写坏构建产物。
 */
export function resolveAlbumPreview(
	config: AlbumsConfig | undefined,
): Required<AlbumPreviewConfig> {
	const raw = config?.preview ?? {};
	return {
		enable: raw.enable ?? PREVIEW_DEFAULTS.enable,
		photoWidth: clampNumber(
			raw.photoWidth,
			240,
			2400,
			PREVIEW_DEFAULTS.photoWidth,
		),
		photoQuality: clampNumber(
			raw.photoQuality,
			40,
			100,
			PREVIEW_DEFAULTS.photoQuality,
		),
		coverWidth: clampNumber(
			raw.coverWidth,
			320,
			3200,
			PREVIEW_DEFAULTS.coverWidth,
		),
		coverQuality: clampNumber(
			raw.coverQuality,
			40,
			100,
			PREVIEW_DEFAULTS.coverQuality,
		),
	};
}
