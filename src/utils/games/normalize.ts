import type {
	GameCredential,
	GameSnapshotCredential,
	GamesProviderKey,
	GamesSnapshot,
} from "../../types/gamesConfig.ts";

/**
 * 游戏资历快照的字段白名单清洗（构建期与同步脚本共用）。
 *
 * 第三方接口字段会漂移，快照也可能被手改：这里只保留已知字段，
 * 对数值做上下界裁剪、对文本做限长，未知字段一律丢弃。
 */

const VALID_PROVIDERS = new Set<GamesProviderKey>([
	"genshin",
	"starrail",
	"zenless",
]);

const SAFE_GAME_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_UID = /^\d{6,12}$/;

const MAX_EXPLORATION = 6;
const MAX_EXTRA = 8;

function toInteger(
	value: unknown,
	min: number,
	max: number,
): number | undefined {
	const numeric =
		typeof value === "number"
			? value
			: typeof value === "string" && value.trim() !== ""
				? Number(value)
				: Number.NaN;
	if (!Number.isFinite(numeric)) return undefined;
	const rounded = Math.round(numeric);
	if (rounded < min || rounded > max) return undefined;
	return rounded;
}

function toText(value: unknown, maxLength: number): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	return trimmed.slice(0, maxLength);
}

/**
 * 判断一组资历指标里是否至少有一项可渲染内容。
 */
export function hasAnyMetric(credential: GameCredential | undefined): boolean {
	if (!credential) return false;
	return Boolean(
		credential.level !== undefined ||
			credential.achievements ||
			(credential.exploration && credential.exploration.length > 0) ||
			credential.challenge ||
			(credential.extra && credential.extra.length > 0),
	);
}

/**
 * 清洗单条资历指标；没有任何有效字段时返回 null。
 */
export function normalizeCredential(raw: unknown): GameCredential | null {
	if (!raw || typeof raw !== "object") return null;
	const source = raw as Record<string, unknown>;
	const credential: GameCredential = {};

	const level = toInteger(source.level, 1, 999);
	if (level !== undefined) credential.level = level;

	const levelLabel = toText(source.levelLabel, 24);
	if (levelLabel) credential.levelLabel = levelLabel;

	const achievements = source.achievements;
	if (achievements && typeof achievements === "object") {
		const record = achievements as Record<string, unknown>;
		const done = toInteger(record.done, 0, 1_000_000);
		const total = toInteger(record.total, 0, 1_000_000);
		if (done !== undefined) {
			credential.achievements = {
				done,
				...(total !== undefined && total >= done ? { total } : {}),
			};
		}
	}

	if (Array.isArray(source.exploration)) {
		const exploration = source.exploration
			.slice(0, MAX_EXPLORATION)
			.map((entry) => {
				if (!entry || typeof entry !== "object") return null;
				const record = entry as Record<string, unknown>;
				const label = toText(record.label, 24);
				const percent = toInteger(record.percent, 0, 100);
				if (!label || percent === undefined) return null;
				return { label, percent };
			})
			.filter((entry): entry is { label: string; percent: number } =>
				Boolean(entry),
			);
		if (exploration.length > 0) credential.exploration = exploration;
	}

	const challenge = source.challenge;
	if (challenge && typeof challenge === "object") {
		const record = challenge as Record<string, unknown>;
		const label = toText(record.label, 24);
		const value = toInteger(record.value, 0, 1_000_000);
		if (label && value !== undefined) {
			const max = toInteger(record.max, 0, 1_000_000);
			const unit = toText(record.unit, 8);
			const season = toText(record.season, 24);
			credential.challenge = {
				label,
				value,
				...(max !== undefined ? { max } : {}),
				...(unit ? { unit } : {}),
				...(season ? { season } : {}),
			};
		}
	}

	if (Array.isArray(source.extra)) {
		const extra = source.extra
			.slice(0, MAX_EXTRA)
			.map((entry) => {
				if (!entry || typeof entry !== "object") return null;
				const record = entry as Record<string, unknown>;
				const key = toText(record.key, 24);
				if (!key) return null;
				const label = toText(record.label, 24);
				const numericValue = toInteger(record.value, 0, 1_000_000_000);
				const value =
					numericValue !== undefined ? numericValue : toText(record.value, 32);
				if (value === undefined) return null;
				return {
					key,
					...(label ? { label } : {}),
					value,
				};
			})
			.filter(
				(
					entry,
				): entry is { key: string; label?: string; value: number | string } =>
					Boolean(entry),
			);
		if (extra.length > 0) credential.extra = extra;
	}

	return hasAnyMetric(credential) ? credential : null;
}

/**
 * 清洗快照中的单条记录；gameId / provider / uid / server 是匹配与审计字段。
 */
export function normalizeSnapshotCredential(
	raw: unknown,
): GameSnapshotCredential | null {
	if (!raw || typeof raw !== "object") return null;
	const source = raw as Record<string, unknown>;

	const gameId = toText(source.gameId, 64);
	const provider = source.provider;
	const uid = toText(source.uid, 12);

	if (
		!gameId ||
		!SAFE_GAME_ID.test(gameId) ||
		typeof provider !== "string" ||
		!VALID_PROVIDERS.has(provider as GamesProviderKey) ||
		!uid ||
		!SAFE_UID.test(uid)
	) {
		return null;
	}

	const credential = normalizeCredential(source);
	if (!credential) return null;

	return {
		gameId,
		provider: provider as GamesProviderKey,
		uid,
		...credential,
	};
}

/**
 * 解析快照封套；版本或 provider 不匹配时返回 null。
 */
export function parseGamesSnapshot(content: string): GamesSnapshot | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== "object") return null;
	const record = parsed as Record<string, unknown>;
	if (record.schemaVersion !== 1 || record.provider !== "enka") return null;
	if (!Array.isArray(record.credentials)) return null;

	const credentials = record.credentials
		.map(normalizeSnapshotCredential)
		.filter((entry): entry is GameSnapshotCredential => Boolean(entry));

	return {
		schemaVersion: 1,
		provider: "enka",
		fetchedAt: typeof record.fetchedAt === "string" ? record.fetchedAt : "",
		accountRef:
			typeof record.accountRef === "string" ? record.accountRef : "enka",
		credentials,
	};
}

/**
 * 合并快照资历：命中 gameId 且指标有效时覆盖手填值，未命中保持原样。
 * 返回的 credential 已剥离 uid，避免进入页面 DOM。
 */
export function mergeGameCredentials<
	T extends { id: string; credential?: GameCredential },
>(items: readonly T[], credentials: readonly GameSnapshotCredential[]): T[] {
	if (credentials.length === 0) return [...items];

	const byGameId = new Map<string, GameCredential>();
	for (const entry of credentials) {
		const { gameId, provider: _provider, uid: _uid, ...credential } = entry;
		if (hasAnyMetric(credential)) {
			byGameId.set(gameId, credential);
		}
	}

	if (byGameId.size === 0) return [...items];

	return items.map((item) => {
		const credential = byGameId.get(item.id);
		return credential ? { ...item, credential } : item;
	});
}
