/**
 * Enka.Network 数据源：公开只读接口，不需要 Cookie、签名或设备指纹。
 *
 * 只读取账号级资历指标（等级 / 成就 / 深境螺旋），忽略角色与装备明细，
 * 因此响应体小、字段稳定，也不存在账号凭据泄漏风险。
 * 前置条件：玩家在游戏内开启「公开角色详情」，否则接口返回 404。
 */

const ENDPOINTS = {
	genshin: (uid) => `https://enka.network/api/uid/${uid}/`,
	starrail: (uid) => `https://enka.network/api/hsr/uid/${uid}/`,
	zenless: (uid) => `https://enka.network/api/zzz/uid/${uid}/`,
};

/** Enka 要求请求方提供可识别的 User-Agent */
const USER_AGENT = "Shirone-Games-Sync/1.0";

/** 深境螺旋共 12 层 */
const GENSHIN_ABYSS_MAX_FLOOR = 12;

function toInteger(value, min, max) {
	const numeric = typeof value === "number" ? value : Number(value);
	if (!Number.isFinite(numeric)) return undefined;
	const rounded = Math.round(numeric);
	if (rounded < min || rounded > max) return undefined;
	return rounded;
}

function extractGenshin(data) {
	const info = data?.playerInfo;
	if (!info || typeof info !== "object") return null;

	const credential = {};
	const level = toInteger(info.level, 1, 200);
	if (level !== undefined) credential.level = level;

	const achievements = toInteger(info.finishAchievementNum, 0, 100000);
	if (achievements !== undefined) {
		credential.achievements = { done: achievements };
	}

	const floor = toInteger(info.towerFloorIndex, 1, GENSHIN_ABYSS_MAX_FLOOR);
	if (floor !== undefined) {
		credential.challenge = {
			label: "深境螺旋",
			value: floor,
			max: GENSHIN_ABYSS_MAX_FLOOR,
			unit: "层",
		};
	}

	return credential;
}

function extractStarRail(data) {
	const detail = data?.detailInfo;
	if (!detail || typeof detail !== "object") return null;

	const credential = {};
	const level = toInteger(detail.level, 1, 200);
	if (level !== undefined) credential.level = level;

	const achievements = toInteger(detail.recordInfo?.achievementCount, 0, 100000);
	if (achievements !== undefined) {
		credential.achievements = { done: achievements };
	}

	return credential;
}

function extractZenless(data) {
	const profile = data?.PlayerInfo?.SocialDetail?.ProfileDetail;
	if (!profile || typeof profile !== "object") return null;

	const credential = {};
	const level = toInteger(profile.Level, 1, 200);
	if (level !== undefined) credential.level = level;

	return credential;
}

const EXTRACTORS = {
	genshin: extractGenshin,
	starrail: extractStarRail,
	zenless: extractZenless,
};

/**
 * 抓取单个账号的资历指标；返回带匹配字段的原始记录（尚未白名单清洗）。
 */
export async function fetchEnkaCredential(entry, { timeoutMs = 15000 } = {}) {
	const buildUrl = ENDPOINTS[entry.provider];
	if (!buildUrl) {
		throw new Error(`不支持的 Enka 游戏标识：${entry.provider}`);
	}

	const response = await fetch(buildUrl(entry.uid), {
		headers: {
			Accept: "application/json",
			"User-Agent": USER_AGENT,
		},
		signal: AbortSignal.timeout(timeoutMs),
	});

	if (response.status === 404) {
		throw new Error("UID 不存在，或游戏内未开启「公开角色详情」");
	}
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}

	const data = await response.json();
	const credential = EXTRACTORS[entry.provider](data);
	if (!credential) {
		throw new Error("返回数据缺少账号信息（可能未开启公开角色详情）");
	}

	return {
		gameId: entry.gameId,
		provider: entry.provider,
		uid: entry.uid,
		...credential,
	};
}
