/**
 * B 站动态快照读取（构建期）。
 *
 * 快照由 `scripts/moments/sync.mjs` 写入代码仓 `src/data/bilibili-moments.json`，
 * 构建期只读本地文件，不产生任何外部请求。快照缺失、损坏或 UID 与当前配置不符时
 * 静默返回空数组，动态页仍只展示手写内容。
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResolvedBilibiliMomentsOptions } from "../config/momentsConfig.ts";

export const BILIBILI_MOMENTS_SNAPSHOT_PATH = "src/data/bilibili-moments.json";

export interface BilibiliMomentSnapshotImage {
	/** 站点内绝对路径，例如 /images/moments/bilibili/123456-0-abcd1234.webp */
	src: string;
	alt: string;
}

export interface BilibiliMomentSnapshotItem {
	/** 站点内稳定 ID，形如 bili-1234567890 */
	id: string;
	/** ISO 8601 时间戳 */
	published: string;
	/** 纯文本正文（构建期走站点 Markdown 插件链渲染） */
	content: string;
	/** B 站原文地址 */
	url: string;
	images: BilibiliMomentSnapshotImage[];
}

export interface BilibiliMomentsSnapshot {
	schemaVersion: 1;
	provider: "bilibili";
	uid: string;
	fetchedAt: string;
	items: BilibiliMomentSnapshotItem[];
}

function isSnapshot(value: unknown): value is BilibiliMomentsSnapshot {
	if (!value || typeof value !== "object") return false;
	const snapshot = value as Partial<BilibiliMomentsSnapshot>;
	return (
		snapshot.schemaVersion === 1 &&
		snapshot.provider === "bilibili" &&
		typeof snapshot.uid === "string" &&
		Array.isArray(snapshot.items)
	);
}

export function readBilibiliMomentsSnapshot(
	projectRoot: string = process.cwd(),
): BilibiliMomentsSnapshot | null {
	const filePath = join(projectRoot, BILIBILI_MOMENTS_SNAPSHOT_PATH);
	if (!existsSync(filePath)) return null;

	try {
		const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
		return isSnapshot(parsed) ? parsed : null;
	} catch {
		// 快照损坏时按「没有同步数据」处理，不阻断构建。
		return null;
	}
}

/**
 * 取出与当前配置匹配的快照条目。
 *
 * UID 校验避免切换账号后仍展示上一个账号的动态；`enable` 为 false 时直接返回空。
 */
export function getBilibiliMomentItems(
	options: ResolvedBilibiliMomentsOptions,
	projectRoot: string = process.cwd(),
): BilibiliMomentSnapshotItem[] {
	if (!options.enable) return [];
	const snapshot = readBilibiliMomentsSnapshot(projectRoot);
	if (!snapshot || snapshot.uid !== options.uid) return [];
	return snapshot.items.slice(0, options.maxItems);
}
