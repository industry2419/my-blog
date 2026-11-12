import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	hasAnyMetric,
	mergeGameCredentials,
	normalizeCredential,
	normalizeSnapshotCredential,
	parseGamesSnapshot,
} from "../src/utils/games/normalize.ts";

const VALID_SNAPSHOT = {
	schemaVersion: 1,
	provider: "enka",
	fetchedAt: "2026-11-12T00:00:00.000Z",
	accountRef: "enka",
	credentials: [
		{
			gameId: "genshin-impact",
			provider: "genshin",
			uid: "100000000",
			level: 60,
			levelLabel: "冒险等阶",
			achievements: { done: 823, total: 1300 },
			exploration: [{ label: "璃月", percent: 100 }],
			challenge: {
				label: "深境螺旋",
				value: 36,
				max: 36,
				unit: "★",
				season: "2026-11",
			},
			extra: [{ key: "activeDays", label: "活跃天数", value: 900 }],
		},
	],
};

describe("normalizeCredential", () => {
	it("保留合法指标并裁剪越界数值", () => {
		const credential = normalizeCredential({
			level: 60.4,
			achievements: { done: 10, total: 20 },
			exploration: [{ label: " 璃月 ", percent: 130, extra: "ignored" }],
			challenge: { label: "深境螺旋", value: 36, max: 36, unit: "★" },
			extra: [{ key: "activeDays", value: "900" }],
			unknown: "dropped",
		});

		assert.ok(credential);
		assert.equal(credential.level, 60);
		assert.deepEqual(credential.achievements, { done: 10, total: 20 });
		// percent 130 超出 0-100，该项被丢弃
		assert.equal(credential.exploration, undefined);
		assert.equal(credential.challenge?.value, 36);
		assert.deepEqual(credential.extra, [{ key: "activeDays", value: 900 }]);
		assert.equal("unknown" in credential, false);
	});

	it("成就总数缺失时只保留完成数", () => {
		const credential = normalizeCredential({
			achievements: { done: 42 },
		});
		assert.deepEqual(credential?.achievements, { done: 42 });
	});

	it("没有任何有效指标时返回 null", () => {
		assert.equal(normalizeCredential({ level: "abc" }), null);
		assert.equal(normalizeCredential(null), null);
		assert.equal(hasAnyMetric({}), false);
		assert.equal(hasAnyMetric({ level: 1 }), true);
	});
});

describe("normalizeSnapshotCredential", () => {
	it("校验 gameId / provider / uid", () => {
		const valid = normalizeSnapshotCredential(VALID_SNAPSHOT.credentials[0]);
		assert.ok(valid);
		assert.equal(valid.gameId, "genshin-impact");
		assert.equal(valid.provider, "genshin");

		assert.equal(
			normalizeSnapshotCredential({
				...VALID_SNAPSHOT.credentials[0],
				gameId: "Invalid ID!",
			}),
			null,
		);
		assert.equal(
			normalizeSnapshotCredential({
				...VALID_SNAPSHOT.credentials[0],
				provider: "unknown",
			}),
			null,
		);
		assert.equal(
			normalizeSnapshotCredential({
				...VALID_SNAPSHOT.credentials[0],
				uid: "abc",
			}),
			null,
		);
	});
});

describe("parseGamesSnapshot", () => {
	it("解析合法快照", () => {
		const snapshot = parseGamesSnapshot(JSON.stringify(VALID_SNAPSHOT));
		assert.ok(snapshot);
		assert.equal(snapshot.credentials.length, 1);
		assert.equal(snapshot.credentials[0].level, 60);
	});

	it("版本或 provider 不匹配时返回 null", () => {
		assert.equal(
			parseGamesSnapshot(
				JSON.stringify({ ...VALID_SNAPSHOT, schemaVersion: 2 }),
			),
			null,
		);
		assert.equal(
			parseGamesSnapshot(
				JSON.stringify({ ...VALID_SNAPSHOT, provider: "other" }),
			),
			null,
		);
	});

	it("损坏 JSON 返回 null", () => {
		assert.equal(parseGamesSnapshot("{not-json"), null);
	});

	it("丢弃非法条目而不是整体失败", () => {
		const snapshot = parseGamesSnapshot(
			JSON.stringify({
				...VALID_SNAPSHOT,
				credentials: [
					VALID_SNAPSHOT.credentials[0],
					{ gameId: "broken" },
				],
			}),
		);
		assert.ok(snapshot);
		assert.equal(snapshot.credentials.length, 1);
	});
});

describe("mergeGameCredentials", () => {
	const items = [
		{ id: "genshin-impact", credential: { level: 1 } },
		{ id: "minecraft" },
	];

	it("按 gameId 覆盖并剥离 uid", () => {
		const credential = normalizeSnapshotCredential(VALID_SNAPSHOT.credentials[0]);
		assert.ok(credential);
		const merged = mergeGameCredentials(items, [credential]);

		assert.equal(merged[0].credential?.level, 60);
		assert.equal("uid" in (merged[0].credential ?? {}), false);
		assert.equal(merged[1].credential, undefined);
	});

	it("没有快照时保持原数组内容", () => {
		const merged = mergeGameCredentials(items, []);
		assert.deepEqual(merged, items);
	});
});
