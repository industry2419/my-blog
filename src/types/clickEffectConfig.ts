/**
 * 鼠标点击闪电特效（皮卡丘放电风格）的站点级配置。
 *
 * 领域注册见 `scripts/content/config-domains.mjs`（key: "clickEffect"）。
 * 访客可在显示设置面板切换「全量 / 减弱」，站点级总开关只负责是否启用。
 */
export type ClickEffectConfig = {
	/** 总开关。默认 true；关闭时不输出画布、零监听器、零客户端代码。 */
	enable?: boolean;
	/** 闪电颜色（十六进制，如 "#ffd400"），默认 "#ffd400"。 */
	color?: string;
	/** 整体尺寸缩放，默认 1（有效范围 0.1–3）。 */
	scale?: number;
	/** 辐射闪电条数，默认 8（有效范围 3–24）。 */
	bolts?: number;
	/** 主干持续时间（毫秒），默认 220（有效范围 80–1000）。 */
	duration?: number;
	/** 辉光强度，默认 1（有效范围 0–2；0 表示不描边发光）。 */
	glow?: number;
	/** 是否喷出火星粒子，默认 true。 */
	sparks?: boolean;
	/** 是否叠加轻微全屏闪白，默认 true。 */
	screenFlash?: boolean;
};

/** 补齐默认值并夹紧范围后的特效参数。 */
export type ResolvedClickEffectOptions = {
	enable: boolean;
	color: string;
	scale: number;
	bolts: number;
	duration: number;
	glow: number;
	sparks: boolean;
	screenFlash: boolean;
};
