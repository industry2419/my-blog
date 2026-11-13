import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	deriveSteamStatus,
	mergeSteamLibraries,
	mergeSteamLocalRecords,
	normalizeSteamGame,
	parseSteamLocalConfig,
	parseSteamLocalSnapshot,
	parseSteamSnapshot,
	sortSteamGames,
} from "../src/utils/games/steam.ts";

const VALID_SNAPSHOT = {
	schemaVersion: 1,
	provider: "steam",
	fetchedAt: "2026-11-12T00:00:00.000Z",
	games: [
		{
			appId: 730,
			name: "Counter-Strike 2",
			minutes: 12000,
			recentMinutes: 240,
			cover: "/games-art/steam/730.webp",
			achievements: { done: 12, total: 40 },
		},
		{
			appId: 570,
			name: "Dota 2",
			minutes: 300,
		},
	],
};

describe("parseSteamSnapshot", () => {
	it("解析合法 Steam 快照并按总时长降序排列", () => {
		const snapshot = parseSteamSnapshot(JSON.stringify(VALID_SNAPSHOT));
		assert.ok(snapshot);
		assert.equal(snapshot.fetchedAt, VALID_SNAPSHOT.fetchedAt);
		assert.deepEqual(
			snapshot.games.map((game) => game.appId),
			[730, 570],
		);
		assert.deepEqual(snapshot.games[0].achievements, { done: 12, total: 40 });
	});

	it("版本或 provider 不匹配时返回 null", () => {
		assert.equal(
			parseSteamSnapshot(
				JSON.stringify({ ...VALID_SNAPSHOT, schemaVersion: 2 }),
			),
			null,
		);
		assert.equal(
			parseSteamSnapshot(
				JSON.stringify({ ...VALID_SNAPSHOT, provider: "enka" }),
			),
			null,
		);
	});

	it("逐条丢弃非法条目并保留合法条目", () => {
		const snapshot = parseSteamSnapshot(
			JSON.stringify({
				...VALID_SNAPSHOT,
				games: [
					...VALID_SNAPSHOT.games,
					{ appId: 0, name: "Bad AppID", minutes: 10 },
					{ appId: 10, name: "", minutes: 10 },
					{ appId: 11, name: "Negative", minutes: -5 },
					{
						appId: 12,
						name: "Remote cover",
						minutes: 10,
						cover: "https://example.com/cover.jpg",
					},
					{
						appId: 13,
						name: "Bad achievements",
						minutes: 10,
						achievements: { done: 9, total: 3 },
					},
				],
			}),
		);
		assert.ok(snapshot);
		assert.deepEqual(
			snapshot.games.map((game) => game.appId),
			[730, 570, 13, 12],
		);
		assert.equal(
			snapshot.games.find((game) => game.appId === 12)?.cover,
			undefined,
		);
		assert.equal(
			snapshot.games.find((game) => game.appId === 13)?.achievements,
			undefined,
		);
	});

	it("没有有效条目时返回 null", () => {
		assert.equal(
			parseSteamSnapshot(JSON.stringify({ ...VALID_SNAPSHOT, games: [] })),
			null,
		);
		assert.equal(
			parseSteamSnapshot(JSON.stringify({ ...VALID_SNAPSHOT, games: null })),
			null,
		);
	});

	it("损坏 JSON 返回 null", () => {
		assert.equal(parseSteamSnapshot("{not-json"), null);
	});
});

describe("normalizeSteamGame", () => {
	it("裁剪文本并丢弃零时长的最近两周记录", () => {
		const entry = normalizeSteamGame({
			appId: 20,
			name: "  Game  ",
			minutes: 90,
			recentMinutes: 0,
		});
		assert.deepEqual(entry, { appId: 20, name: "Game", minutes: 90 });
	});

	it("标签去重、去空并最多保留 3 个", () => {
		const entry = normalizeSteamGame({
			appId: 21,
			name: "Tagged",
			minutes: 10,
			tags: [" Action ", "Action", "", 42, "Adventure", "RPG", "Extra"],
		});
		assert.deepEqual(entry?.tags, ["Action", "Adventure", "RPG"]);
	});

	it("没有合法标签时不输出 tags 字段", () => {
		const entry = normalizeSteamGame({
			appId: 22,
			name: "Untagged",
			minutes: 10,
			tags: ["", 7],
		});
		assert.deepEqual(entry, { appId: 22, name: "Untagged", minutes: 10 });
	});
});

describe("parseSteamLocalSnapshot", () => {
	it("接受 steam-local provider 并保留条目", () => {
		const snapshot = parseSteamLocalSnapshot(
			JSON.stringify({
				...VALID_SNAPSHOT,
				provider: "steam-local",
				games: [{ appId: 2358720, name: "Black Myth: Wukong", minutes: 4064 }],
			}),
		);
		assert.ok(snapshot);
		assert.equal(snapshot.provider, "steam-local");
		assert.deepEqual(snapshot.games, [
			{
				appId: 2358720,
				name: "Black Myth: Wukong",
				minutes: 4064,
				local: true,
			},
		]);
	});

	it("在线快照不会带 local 标记", () => {
		const snapshot = parseSteamSnapshot(JSON.stringify(VALID_SNAPSHOT));
		assert.ok(snapshot);
		assert.equal(snapshot.games[0].local, undefined);
	});

	it("provider 为 steam 时返回 null", () => {
		assert.equal(parseSteamLocalSnapshot(JSON.stringify(VALID_SNAPSHOT)), null);
	});
});

describe("mergeSteamLibraries", () => {
	it("按 AppID 去重、在线优先并按总时长排序取前 N 款", () => {
		const owned = [
			{ appId: 1, name: "Owned A", minutes: 100 },
			{ appId: 2, name: "Owned B", minutes: 50 },
		];
		const local = [
			{ appId: 1, name: "Shared A", minutes: 999 },
			{ appId: 3, name: "Shared C", minutes: 300 },
			{ appId: 4, name: "Shared D", minutes: 10 },
		];

		const merged = mergeSteamLibraries(owned, local, 3);

		assert.deepEqual(
			merged.map((game) => game.appId),
			[3, 1, 2],
		);
		assert.equal(merged.find((game) => game.appId === 1)?.name, "Owned A");
	});

	it("没有本地记录时保持在线顺序，非法上限回退到全部", () => {
		const owned = Array.from({ length: 15 }, (_, index) => ({
			appId: index + 1,
			name: `Game ${index + 1}`,
			minutes: 100 - index,
		}));
		assert.equal(mergeSteamLibraries(owned, [], 0).length, 1);
		assert.equal(mergeSteamLibraries(owned, [], Number.NaN).length, 15);
	});

	it("刚补购的游戏继承补录快照里的标签", () => {
		const owned = [{ appId: 1, name: "Owned A", minutes: 100 }];
		const local = [
			{ appId: 1, name: "Shared A", minutes: 30, tags: ["Action"], local: true },
		];

		const [merged] = mergeSteamLibraries(owned, local, 10);

		assert.equal(merged.name, "Owned A");
		assert.deepEqual(merged.tags, ["Action"]);
	});
});

describe("mergeSteamLocalRecords", () => {
	it("新记录更小时保留旧记录，视为另一台电脑", () => {
		const existing = [
			{ appId: 1, name: "Shared A", minutes: 900, local: true },
		];
		const incoming = [{ appId: 1, name: "Shared A", minutes: 60 }];

		const merged = mergeSteamLocalRecords(existing, incoming, new Set());

		assert.deepEqual(merged, existing);
	});

	it("新记录更大时更新时长，并沿用旧封面与成就", () => {
		const existing = [
			{
				appId: 1,
				name: "Shared A",
				minutes: 900,
				cover: "/games-art/steam/1.webp",
				achievements: { done: 3, total: 10 },
				local: true,
			},
		];
		const incoming = [
			{ appId: 1, name: "Shared A", minutes: 1200, recentMinutes: 30 },
		];

		const [merged] = mergeSteamLocalRecords(existing, incoming, new Set());

		assert.equal(merged.minutes, 1200);
		assert.equal(merged.recentMinutes, 30);
		assert.equal(merged.cover, "/games-art/steam/1.webp");
		assert.deepEqual(merged.achievements, { done: 3, total: 10 });
	});

	it("新记录缺少标签时沿用旧标签", () => {
		const existing = [
			{ appId: 1, name: "Shared A", minutes: 900, tags: ["Action"], local: true },
		];
		const incoming = [{ appId: 1, name: "Shared A", minutes: 1200 }];

		const [merged] = mergeSteamLocalRecords(existing, incoming, new Set());

		assert.deepEqual(merged.tags, ["Action"]);
	});

	it("保留新记录中已缺失的旧条目，并剔除已补购的游戏", () => {
		const existing = [
			{ appId: 1, name: "Shared A", minutes: 900, local: true },
			{ appId: 2, name: "Owned Now", minutes: 200, local: true },
		];
		const incoming = [{ appId: 3, name: "Shared B", minutes: 30 }];
		const ownedIds = new Set([2]);

		const merged = mergeSteamLocalRecords(existing, incoming, ownedIds);

		assert.deepEqual(
			merged.map((game) => game.appId),
			[1, 3],
		);
		assert.equal(merged[0].local, true);
	});
});

describe("parseSteamLocalConfig", () => {
	const CONFIG = `"UserLocalConfigStore"
{
	"Software"
	{
		"Valve"
		{
			"Steam"
			{
				"apps"
				{
					"2358720"
					{
						"LastPlayed"		"1762335120"
						"Playtime"		"4064"
						"Playtime2wks"		"120"
					}
					"1091500"
					{
						"Playtime"		"909"
					}
					"550"
					{
						"Playtime"		"0"
					}
				}
			}
		}
	}
}`;

	it("提取 apps 段的 Playtime/Playtime2wks/LastPlayed", () => {
		assert.deepEqual(parseSteamLocalConfig(CONFIG), [
			{
				appId: 2358720,
				minutes: 4064,
				recentMinutes: 120,
				lastPlayed: 1762335120,
			},
			{ appId: 1091500, minutes: 909 },
		]);
	});

	it("没有 apps 段或零时长时返回空数组", () => {
		assert.deepEqual(parseSteamLocalConfig('"root"\n{\n}\n'), []);
		assert.deepEqual(
			parseSteamLocalConfig(
				'"apps"\n{\n\t"550"\n\t{\n\t\t"Playtime"\t\t"0"\n\t}\n}\n',
			),
			[],
		);
	});
});

describe("sortSteamGames", () => {
	it("时长相同按名称稳定排序且不修改输入", () => {
		const input = [
			{ appId: 2, name: "Beta", minutes: 60 },
			{ appId: 1, name: "Alpha", minutes: 60 },
			{ appId: 3, name: "Gamma", minutes: 120 },
		];
		const sorted = sortSteamGames(input);
		assert.deepEqual(
			sorted.map((game) => game.name),
			["Gamma", "Alpha", "Beta"],
		);
		assert.deepEqual(
			input.map((game) => game.name),
			["Beta", "Alpha", "Gamma"],
		);
	});
});

describe("deriveSteamStatus", () => {
	it("最近两周有游玩优先判定为正在游玩", () => {
		assert.equal(
			deriveSteamStatus({ appId: 1, name: "A", minutes: 10, recentMinutes: 5 }),
			"playing",
		);
	});

	it("成就全部达成判定为已通关", () => {
		assert.equal(
			deriveSteamStatus({
				appId: 1,
				name: "A",
				minutes: 600,
				achievements: { done: 40, total: 40 },
			}),
			"completed",
		);
	});

	it("已入库但从未启动判定为积压待玩", () => {
		assert.equal(deriveSteamStatus({ appId: 1, name: "A", minutes: 0 }), "backlog");
	});

	it("玩过但已停且未满成就也归入积压待玩", () => {
		assert.equal(
			deriveSteamStatus({
				appId: 1,
				name: "A",
				minutes: 120,
				achievements: { done: 3, total: 20 },
			}),
			"backlog",
		);
		assert.equal(
			deriveSteamStatus({
				appId: 2,
				name: "B",
				minutes: 120,
				achievements: { done: 0, total: 0 },
			}),
			"backlog",
		);
	});
});
