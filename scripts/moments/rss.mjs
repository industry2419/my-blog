/**
 * RSSHub「B 站用户动态」Feed 解析。
 *
 * 纯函数，不访问网络，可直接在 `node --test` 下导入验证。
 * RSSHub 把动态正文放在 `description` 里，外层是 XML 转义后的 HTML；
 * 这里统一还原为纯文本（保留段落与链接），并抽出配图地址。
 */

import { createHash } from "node:crypto";

const NAMED_ENTITIES = new Map([
	["amp", "&"],
	["lt", "<"],
	["gt", ">"],
	["quot", '"'],
	["apos", "'"],
	["nbsp", " "],
]);

const IMAGE_TAG_PATTERN = /<img\b[^>]*>/gi;
const IMG_SRC_PATTERN = /\bsrc\s*=\s*["']([^"']+)["']/i;
const ANCHOR_PATTERN =
	/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

function safeFromCodePoint(code) {
	if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return null;
	try {
		return String.fromCodePoint(code);
	} catch {
		return null;
	}
}

/** 还原 XML / HTML 实体，且只还原一次（避免 `&amp;lt;` 被二次解码成标签）。 */
export function decodeXmlEntities(value) {
	return String(value ?? "").replace(
		/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]+);/g,
		(match, entity) => {
			if (entity[0] === "#") {
				const isHex = entity[1] === "x" || entity[1] === "X";
				const code = Number.parseInt(
					isHex ? entity.slice(2) : entity.slice(1),
					isHex ? 16 : 10,
				);
				return safeFromCodePoint(code) ?? match;
			}
			return (
				NAMED_ENTITIES.get(entity) ??
				NAMED_ENTITIES.get(entity.toLowerCase()) ??
				match
			);
		},
	);
}

function unwrapCdata(value) {
	return String(value ?? "")
		.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
		.trim();
}

function readTag(body, name) {
	const pattern = new RegExp(
		`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,
		"i",
	);
	const match = body.match(pattern);
	return match ? unwrapCdata(match[1]) : "";
}

/** 去掉所有标签，只保留文本。 */
export function stripTags(value) {
	return String(value ?? "").replace(/<[^>]*>/g, " ");
}

/** 把 B 站图床常见的协议相对/HTTP 地址统一为 HTTPS。 */
export function normalizeImageUrl(value) {
	const url = String(value ?? "").trim();
	if (url.startsWith("//")) return `https:${url}`;
	if (url.startsWith("http://")) return `https://${url.slice(7)}`;
	return url;
}

/** 从动态 HTML 中按出现顺序提取配图，去重。 */
export function extractImages(html) {
	const images = [];
	const seen = new Set();
	for (const tag of decodeXmlEntities(html).matchAll(IMAGE_TAG_PATTERN)) {
		const src = tag[0].match(IMG_SRC_PATTERN)?.[1];
		if (!src) continue;
		const normalized = normalizeImageUrl(src);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		images.push(normalized);
	}
	return images;
}

/** 动态 HTML → 纯文本：保留换行与链接，移除图片占位符。 */
export function htmlToPlainText(html) {
	let text = decodeXmlEntities(html)
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

	text = text.replace(ANCHOR_PATTERN, (_, href, label) => {
		const url = href.trim();
		const anchorText = stripTags(label).trim() || url;
		return anchorText === url ? url : `[${anchorText}](${url})`;
	});

	text = text
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|li|h[1-6])>/gi, "\n\n")
		.replace(IMAGE_TAG_PATTERN, "")
		.replace(/\[图片\]/g, "");

	text = stripTags(text)
		.replace(/\u00a0/g, " ")
		.replace(/\r\n?/g, "\n");

	const lines = text.split("\n").map((line) => line.trimEnd());
	const compact = [];
	for (const line of lines) {
		if (line.trim() === "" && compact.at(-1) === "") continue;
		compact.push(line);
	}
	return compact.join("\n").trim();
}

function toItemId(raw) {
	const value = unwrapCdata(raw).trim();
	const numeric = value.match(/(\d{6,})/);
	if (numeric) return `bili-${numeric[1]}`;
	if (!value) return "";
	const digest = createHash("sha1").update(value).digest("hex").slice(0, 12);
	return `bili-${digest}`;
}

function normalizeItemUrl(raw) {
	const value = decodeXmlEntities(raw).trim();
	if (!value) return "";
	if (value.startsWith("//")) return `https:${value}`;
	if (value.startsWith("http://")) return `https://${value.slice(7)}`;
	return value;
}

function readPublishedDate(raw, fallback) {
	const date = new Date(decodeXmlEntities(raw).trim());
	return Number.isNaN(date.getTime())
		? fallback.toISOString()
		: date.toISOString();
}

/**
 * 解析一页动态 Feed。
 *
 * @param {string} xml RSS 文本
 * @param {{ now?: Date }} [options] 解析不到日期时的回退时间
 * @returns {{ id: string, published: string, content: string, url: string, images: string[] }[]}
 */
export function parseBilibiliDynamicFeed(xml, { now = new Date() } = {}) {
	const items = [];
	const seen = new Set();

	for (const match of String(xml ?? "").matchAll(
		/<item\b[^>]*>([\s\S]*?)<\/item>/gi,
	)) {
		const body = match[1];
		const link = readTag(body, "link");
		const guid = readTag(body, "guid");
		const id = toItemId(guid || link);
		if (!id || seen.has(id)) continue;

		const description = readTag(body, "description");
		const title = htmlToPlainText(readTag(body, "title"));
		const content = htmlToPlainText(description) || title;
		if (!content) continue;

		seen.add(id);
		items.push({
			id,
			published: readPublishedDate(readTag(body, "pubDate"), now),
			content,
			url: normalizeItemUrl(link || guid),
			images: extractImages(description),
		});
	}

	return items.sort(
		(a, b) => Date.parse(b.published) - Date.parse(a.published),
	);
}
