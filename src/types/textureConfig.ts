/** 纹理预设类型枚举 */
export type TexturePreset =
	| "none" // 纯色无纹理
	| "starlight" // 二次元星芒光斑
	| "cyber-dots" // 极客点阵与准星
	| "topography" // 流光等高线波纹
	| "geometric" // M3E 晶体折纸
	| "sakura" // 落樱微瓣飘落
	| "palace"; // 宫廷玉夜（亮色回纹/云纹，暗色宫门/回纹，空白处星芒光斑）

/** 纹理配置契约 */
export interface TextureConfig {
	/** 是否启用纹理系统 */
	enable?: boolean;
	/** 默认生效的纹理预设 */
	defaultPreset?: TexturePreset;
	/** 默认纹理不透明度 (0.05 ~ 0.25, 默认 0.12) */
	defaultOpacity?: number;
	/** 是否允许背景微动效 (在开启 reduced-motion 时强制静止) */
	allowMotion?: boolean;
}

/** 规范化解析后的纹理配置选项 */
export interface ResolvedTextureOptions {
	enable: boolean;
	defaultPreset: TexturePreset;
	defaultOpacity: number;
	allowMotion: boolean;
}
