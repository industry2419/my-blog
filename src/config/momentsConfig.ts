import type {
	BilibiliMomentsSource,
	MomentsConfig,
} from "../types/momentsConfig.ts";
import { withUserConfig } from "../utils/config-overlay.ts";

const DEFAULT_RSSHUB_BASE_URL = "https://rsshub.liumingye.cn";
const DEFAULT_MAX_ITEMS = 20;

const bilibiliDefaults: Required<BilibiliMomentsSource> = {
	enable: false,
	uid: "",
	rsshubBaseUrl: DEFAULT_RSSHUB_BASE_URL,
	maxItems: DEFAULT_MAX_ITEMS,
	keepLastValid: true,
	downloadImages: true,
	tags: [],
};

export const momentsConfig: MomentsConfig = withUserConfig("moments", {
	enable: true,
	title: "$t:moments",
	description: "$t:momentsBanner",
	bilibili: bilibiliDefaults,
});

export interface ResolvedBilibiliMomentsOptions {
	enable: boolean;
	uid: string;
	rsshubBaseUrl: string;
	maxItems: number;
	keepLastValid: boolean;
	downloadImages: boolean;
	tags: string[];
}

/**
 * 归一化 B 站动态同步配置。
 *
 * `enable` 同时要求 UID 非空：只写开关不写账号时同步脚本会给出明确提示，
 * 构建期也不会去读取一份不属于当前账号的旧快照。
 */
export function resolveBilibiliMomentsOptions(
	config: MomentsConfig = momentsConfig,
): ResolvedBilibiliMomentsOptions {
	const raw = config.bilibili ?? {};
	const uid = String(raw.uid ?? "").trim();
	const maxItems =
		typeof raw.maxItems === "number" &&
		Number.isFinite(raw.maxItems) &&
		raw.maxItems > 0
			? Math.floor(raw.maxItems)
			: DEFAULT_MAX_ITEMS;

	return {
		enable: raw.enable === true && uid !== "",
		uid,
		rsshubBaseUrl: String(raw.rsshubBaseUrl ?? DEFAULT_RSSHUB_BASE_URL)
			.trim()
			.replace(/\/+$/, ""),
		maxItems,
		keepLastValid: raw.keepLastValid !== false,
		downloadImages: raw.downloadImages !== false,
		tags: Array.isArray(raw.tags)
			? raw.tags.map((tag) => String(tag).trim()).filter(Boolean)
			: [],
	};
}
