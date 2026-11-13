import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import {
	BILIBILI_MOMENTS_SNAPSHOT_PATH,
	getBilibiliMomentItems,
	readBilibiliMomentsSnapshot,
} from "../src/utils/bilibili-moments.ts";

const roots = [];

function createRoot(snapshot) {
	const root = mkdtempSync(join(tmpdir(), "shirone-moments-"));
	roots.push(root);
	if (snapshot !== undefined) {
		const filePath = join(root, BILIBILI_MOMENTS_SNAPSHOT_PATH);
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(
			filePath,
			typeof snapshot === "string" ? snapshot : JSON.stringify(snapshot),
		);
	}
	return root;
}

const SNAPSHOT = {
	schemaVersion: 1,
	provider: "bilibili",
	uid: "123456",
	fetchedAt: "2026-11-13T00:00:00.000Z",
	items: [
		{
			id: "bili-1",
			published: "2026-11-13T00:00:00.000Z",
			content: "第一条",
			url: "https://t.bilibili.com/1",
			images: [],
		},
		{
			id: "bili-2",
			published: "2026-11-12T00:00:00.000Z",
			content: "第二条",
			url: "https://t.bilibili.com/2",
			images: [],
		},
	],
};

const OPTIONS = {
	enable: true,
	uid: "123456",
	rsshubBaseUrl: "https://rsshub.example.com",
	maxItems: 10,
	keepLastValid: true,
	downloadImages: true,
	tags: ["B站"],
};

after(() => {
	for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("B 站动态快照读取", () => {
	it("读取合法快照并应用 maxItems", () => {
		const root = createRoot(SNAPSHOT);
		assert.equal(readBilibiliMomentsSnapshot(root)?.uid, "123456");
		assert.deepEqual(
			getBilibiliMomentItems({ ...OPTIONS, maxItems: 1 }, root).map(
				(item) => item.id,
			),
			["bili-1"],
		);
	});

	it("关闭同步或 UID 不匹配时不返回任何条目", () => {
		const root = createRoot(SNAPSHOT);
		assert.deepEqual(
			getBilibiliMomentItems({ ...OPTIONS, enable: false }, root),
			[],
		);
		assert.deepEqual(
			getBilibiliMomentItems({ ...OPTIONS, uid: "999" }, root),
			[],
		);
	});

	it("快照缺失或损坏时静默降级", () => {
		assert.equal(readBilibiliMomentsSnapshot(createRoot()), null);
		assert.equal(readBilibiliMomentsSnapshot(createRoot("{oops")), null);
		assert.deepEqual(getBilibiliMomentItems(OPTIONS, createRoot()), []);
	});
});
