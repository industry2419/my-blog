import type { PageMeta } from "./pageMeta.ts";

/**
 * B 站动态同步源（RSSHub）。
 *
 * 关闭时构建期不读取快照、页面不输出任何相关内容；同步脚本也不会发起请求。
 */
export interface BilibiliMomentsSource {
	/** 是否启用同步；`uid` 为空时即使开启也不会生效 */
	enable?: boolean;
	/** B 站数字 UID，取自 space.bilibili.com/<uid> */
	uid?: string;
	/** 公共 RSSHub 实例根地址，末尾斜杠会被忽略 */
	rsshubBaseUrl?: string;
	/** 快照最多保留的动态条数 */
	maxItems?: number;
	/** 抓取失败或返回空时保留上一次有效快照 */
	keepLastValid?: boolean;
	/** 下载动态配图并转为 WebP；关闭时只保留文字 */
	downloadImages?: boolean;
	/** 追加到每条同步动态的标签，便于在动态页按来源筛选 */
	tags?: string[];
}

export interface MomentsConfig extends PageMeta {
	bilibili?: BilibiliMomentsSource;
}
