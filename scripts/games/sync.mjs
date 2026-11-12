import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gamesConfig, resolveGamesOptions } from "../../src/config/gamesConfig.ts";
import {
	normalizeSnapshotCredential,
	parseGamesSnapshot,
} from "../../src/utils/games/normalize.ts";
import { commitSnapshot, isSnapshotStale } from "../anime/snapshot-store.mjs";
import { fetchEnkaCredential } from "./providers/enka.mjs";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));

const SENSITIVE_PATTERNS = [
	/\bltoken/i,
	/\bltuid/i,
	/\bcookie\s*[:=]/i,
	/\bauthorization\s*[:=]/i,
	/\bds=/i,
];

function scanForSensitiveData(jsonString) {
	for (const pattern of SENSITIVE_PATTERNS) {
		if (pattern.test(jsonString)) {
			throw new Error(
				`Security Violation: 快照数据中检测到敏感字段：${pattern.toString()}`,
			);
		}
	}
}

function sleep(ms) {
	return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function parseArgs(argv) {
	const result = { games: [], ifStale: false, dryRun: false };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--if-stale") {
			result.ifStale = true;
		} else if (arg === "--dry-run") {
			result.dryRun = true;
		} else if (arg === "--game") {
			const value = argv[index + 1];
			if (value && !value.startsWith("--")) {
				result.games.push(...value.split(","));
				index += 1;
			}
		} else if (arg.startsWith("--game=")) {
			result.games.push(...arg.slice("--game=".length).split(","));
		}
	}
	result.games = result.games.map((game) => game.trim()).filter(Boolean);
	return result;
}

function readPreviousCredentials(targetFile) {
	if (!existsSync(targetFile)) return [];
	try {
		const snapshot = parseGamesSnapshot(readFileSync(targetFile, "utf-8"));
		return snapshot?.credentials ?? [];
	} catch {
		return [];
	}
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const options = resolveGamesOptions(gamesConfig);
	const provider = gamesConfig.providers?.enka;

	if (!provider?.enable) {
		console.log(
			"[games-sync] Enka 同步未启用（gamesConfig.providers.enka.enable = false），跳过。",
		);
		return;
	}

	const entries = provider.games ?? [];
	if (entries.length === 0) {
		console.warn(
			"[games-sync] 未配置任何游戏账号（providers.enka.games 为空），跳过。",
		);
		return;
	}

	const directory = isAbsolute(options.snapshot.directory)
		? options.snapshot.directory
		: resolve(projectRoot, options.snapshot.directory);
	const targetFile = join(directory, options.source.file ?? "enka.json");

	if (args.ifStale && !isSnapshotStale(targetFile, options.snapshot.staleAfterDays)) {
		console.log(
			`[games-sync] 快照仍新鲜（< ${options.snapshot.staleAfterDays} 天），按 --if-stale 跳过。`,
		);
		return;
	}

	const requested = new Set(args.games);
	const useAll = requested.size === 0 || requested.has("all");
	const selected = useAll
		? entries
		: entries.filter(
				(entry) =>
					requested.has(entry.provider) || requested.has(entry.gameId),
			);

	if (selected.length === 0) {
		console.warn(
			`[games-sync] 没有匹配的游戏（--game ${[...requested].join(",")}），跳过。`,
		);
		return;
	}

	console.log(
		`[games-sync] 开始同步 ${selected.length} 个账号：${selected
			.map((entry) => `${entry.provider}:${entry.gameId}`)
			.join(", ")}`,
	);

	const delayMs = provider.request?.minDelayMs ?? 600;
	const timeoutMs = provider.request?.timeoutMs ?? 15000;

	const collected = new Map();
	const failures = [];

	for (const [index, entry] of selected.entries()) {
		try {
			const raw = await fetchEnkaCredential(entry, { timeoutMs });
			const normalized = normalizeSnapshotCredential(raw);
			if (!normalized) {
				throw new Error("接口返回的资历字段为空或格式不合法");
			}
			collected.set(normalized.gameId, normalized);
			console.log(
				`[games-sync] ✓ ${entry.provider} (${entry.gameId}) 同步成功`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			failures.push(`${entry.provider}:${entry.gameId} → ${message}`);
			console.warn(
				`[games-sync] ✗ ${entry.provider} (${entry.gameId}) 同步失败：${message}`,
			);
		}

		if (delayMs > 0 && index < selected.length - 1) {
			await sleep(delayMs);
		}
	}

	// 本次失败的条目沿用旧快照，避免一次网络波动导致资历整体消失。
	const successCount = collected.size;
	const previous = readPreviousCredentials(targetFile);
	const configuredGameIds = new Set(entries.map((entry) => entry.gameId));
	for (const oldEntry of previous) {
		if (!configuredGameIds.has(oldEntry.gameId)) continue;
		if (!collected.has(oldEntry.gameId)) {
			collected.set(oldEntry.gameId, oldEntry);
		}
	}

	const credentials = [...collected.values()].sort((left, right) =>
		left.gameId.localeCompare(right.gameId),
	);

	if (args.dryRun) {
		console.log(
			JSON.stringify(
				{
					schemaVersion: 1,
					provider: "enka",
					accountRef: "enka",
					successCount,
					credentialCount: credentials.length,
					failures,
					credentials,
				},
				null,
				2,
			),
		);
		console.log("[games-sync] --dry-run：未写入任何文件。");
		return;
	}

	if (collected.size === 0) {
		console.warn(
			"[games-sync] ⚠ 所有账号均同步失败且没有可复用的旧快照，保留现状不写入。",
		);
		return;
	}

	if (failures.length > 0) {
		console.warn(
			`[games-sync] ⚠ ${failures.length} 个账号失败，已回退到旧快照（若存在）。`,
		);
	}

	const snapshot = {
		schemaVersion: 1,
		provider: "enka",
		fetchedAt: new Date().toISOString(),
		accountRef: "enka",
		credentials,
	};

	const jsonContent = JSON.stringify(snapshot, null, 2);
	scanForSensitiveData(jsonContent);

	const tempFile = join(directory, `.temp-enka-${Date.now()}.json`);
	const outcome = commitSnapshot({
		targetFile,
		tempFile,
		jsonContent,
		itemCount: credentials.length,
		keepLastValid: options.snapshot.keepLastValid,
		itemsKey: "credentials",
	});

	if (outcome === "kept") {
		console.warn(
			`[games-sync] ⚠ 本次没有有效资历数据，保留旧快照：${targetFile}`,
		);
		return;
	}

	console.log(
		`[games-sync] ✓ 已写入 ${credentials.length} 条资历快照：${targetFile}`,
	);
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`[games-sync] 同步失败：${message}`);
	process.exitCode = 1;
});
