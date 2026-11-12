import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGameCovers } from "../src/utils/games/covers.ts";

const VALID_SNAPSHOT = {
	schemaVersion: 1,
	fetchedAt: "2026-11-12T00:00:00.000Z",
	covers: {
		"genshin-impact": "/games-art/genshin-impact.webp",
		"honkai-star-rail": "/games-art/honkai-star-rail.webp",
	},
};

describe("parseGameCovers", () => {
	it("解析合法封面快照", () => {
		const snapshot = parseGameCovers(JSON.stringify(VALID_SNAPSHOT));
		assert.ok(snapshot);
		assert.equal(snapshot.fetchedAt, VALID_SNAPSHOT.fetchedAt);
		assert.deepEqual(snapshot.covers, VALID_SNAPSHOT.covers);
	});

	it("版本不匹配时返回 null", () => {
		assert.equal(
			parseGameCovers(JSON.stringify({ ...VALID_SNAPSHOT, schemaVersion: 2 })),
			null,
		);
	});

	it("拒绝越界或非站内路径", () => {
		const snapshot = parseGameCovers(
			JSON.stringify({
				...VALID_SNAPSHOT,
				covers: {
					"genshin-impact": "/games-art/genshin-impact.webp",
					escape: "/games-art/../../etc/passwd",
					remote: "https://example.com/cover.webp",
					outside: "/images/games/genshin-impact.webp",
					"Bad ID": "/games-art/bad.webp",
				},
			}),
		);
		assert.ok(snapshot);
		assert.deepEqual(Object.keys(snapshot.covers), ["genshin-impact"]);
	});

	it("没有任何有效条目时返回 null", () => {
		assert.equal(
			parseGameCovers(JSON.stringify({ ...VALID_SNAPSHOT, covers: {} })),
			null,
		);
		assert.equal(
			parseGameCovers(JSON.stringify({ ...VALID_SNAPSHOT, covers: [] })),
			null,
		);
		assert.equal(parseGameCovers(JSON.stringify({ ...VALID_SNAPSHOT, covers: null })), null);
	});

	it("损坏 JSON 返回 null", () => {
		assert.equal(parseGameCovers("{not-json"), null);
	});
});
