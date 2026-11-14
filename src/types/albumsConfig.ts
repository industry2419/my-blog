import type { PageMeta } from "./pageMeta.ts";

/**
 * 相册网格衍生图的生成参数。所有字段可选，未设置时回退到生成器默认值。
 * 原图始终保留在 `public/images/albums`，灯箱直接引用原图，因此这里的压缩
 * 参数只影响网格与封面，不影响访客查看无损原图。
 */
export interface AlbumPreviewConfig {
	/** 是否在构建期生成衍生图；关闭后网格回退为原图。 */
	enable?: boolean;
	/** 网格图宽度（像素）。 */
	photoWidth?: number;
	/** 网格图 WebP 质量（40–100）。 */
	photoQuality?: number;
	/** 封面图宽度（像素）。 */
	coverWidth?: number;
	/** 封面图 WebP 质量（40–100）。 */
	coverQuality?: number;
}

export interface AlbumsConfig extends PageMeta {
	preview?: AlbumPreviewConfig;
}
