import type {
	ClickEffectConfig,
	ResolvedClickEffectOptions,
} from "@/types/clickEffectConfig";
import { withUserConfig } from "../utils/config-overlay.ts";

/**
 * 鼠标点击闪电特效：皮卡丘放电风格的黄色电弧 + 冲击环 + 火星。
 *
 * `enable` 是站点级总开关（默认开启）。关闭时布局不输出特效组件，不注册
 * 任何全局监听，也不把特效运行时打进页面。启用后访客仍可在显示设置面板
 * 切换「全量 / 减弱」：关闭开关时只保留扩散光圈，而不是彻底没有反馈。
 */
export const clickEffectConfig: ClickEffectConfig = withUserConfig(
	"clickEffect",
	{
		enable: true,
		color: "#ffd400",
		scale: 1,
		bolts: 8,
		duration: 220,
		glow: 1,
		sparks: true,
		screenFlash: true,
	},
);

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function clamp(value: unknown, min: number, max: number, fallback: number) {
	const num = typeof value === "number" ? value : Number.NaN;
	if (!Number.isFinite(num)) return fallback;
	return Math.min(Math.max(num, min), max);
}

/** 解析特效参数：补齐默认值、夹紧范围，并让关闭状态短路。 */
export function resolveClickEffectOptions(
	config: ClickEffectConfig = clickEffectConfig,
): ResolvedClickEffectOptions {
	const color =
		typeof config.color === "string" && HEX_COLOR.test(config.color.trim())
			? config.color.trim()
			: "#ffd400";
	return {
		enable: config.enable === true,
		color,
		scale: clamp(config.scale, 0.1, 3, 1),
		bolts: Math.round(clamp(config.bolts, 3, 24, 8)),
		duration: Math.round(clamp(config.duration, 80, 1000, 220)),
		glow: clamp(config.glow, 0, 2, 1),
		sparks: config.sparks !== false,
		screenFlash: config.screenFlash !== false,
	};
}
