/**
 * 飞书消息 → 动态的纯函数层。
 *
 * 这里只做解析、分组与渲染，不触碰网络和文件系统，便于在 `node --test` 中
 * 直接验证。发布器（feishu.mjs）负责取 token、拉消息、下载图片与落盘。
 *
 * 语义约定：
 * - 同一发送者在 `gapMs`（默认 5 分钟）内连续发送的文字与图片合并为一条动态；
 * - `/skip` 开头的消息直接忽略，`/draft` 开头写入草稿；
 * - 消息末尾「只由 #标签 组成的行」会被搬进 frontmatter 的 tags。
 */

const DRAFT_PREFIX = /^\s*\/draft\b/i;
const SKIP_PREFIX = /^\s*\/skip\b/i;
const HASHTAG_LINE = /^\s*(#[^\s#]+)(\s+#[^\s#]+)*\s*$/;
const HASHTAG_TOKEN = /#[^\s#]+/g;
// 站内路径以 `/` 开头，YAML 里无需引号；含冒号、空格等特殊字符时才加引号。
const YAML_SAFE_SCALAR = /^\/?[\p{L}\p{N}_-][\p{L}\p{N}\s_\-.,/]*$/u;
const FEISHU_ID_PREFIX = /^om_/;
const UNSAFE_FILE_CHARS = /[^a-zA-Z0-9_-]/g;

/** 消息体是 JSON 字符串；空串或坏数据一律视为不可用。 */
function parseBody(item) {
	const raw = item?.body?.content;
	if (typeof raw !== "string" || raw.trim() === "") return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

/** 把 `@_user_1` 占位符还原成可读的 @名字。 */
function applyMentions(text, mentions) {
	if (typeof text !== "string" || text === "") return "";
	if (!Array.isArray(mentions) || mentions.length === 0) return text;
	let result = text;
	for (const mention of mentions) {
		if (!mention?.key) continue;
		result = result.split(mention.key).join(`@${mention.name ?? ""}`);
	}
	return result;
}

/**
 * 富文本消息可能直接给出 `content`，也可能包一层语言键（zh_cn / en_us）。
 */
function pickPostPayload(payload) {
	if (!payload || typeof payload !== "object") return null;
	if (Array.isArray(payload.content)) return payload;
	for (const value of Object.values(payload)) {
		if (value && typeof value === "object" && Array.isArray(value.content)) {
			return value;
		}
	}
	return null;
}

/** 富文本按行拍平：图片单独收集，链接保留成 Markdown。 */
function flattenPostBlocks(blocks) {
	const lines = [];
	const imageKeys = [];

	for (const line of Array.isArray(blocks) ? blocks : []) {
		let text = "";
		for (const node of Array.isArray(line) ? line : []) {
			switch (node?.tag) {
				case "text":
					text += node.text ?? "";
					break;
				case "a": {
					const label = node.text ?? node.href ?? "";
					text += node.href ? `[${label}](${node.href})` : label;
					break;
				}
				case "at":
					text += `@${node.user_name ?? ""}`;
					break;
				case "code_block":
					text += `\n\`\`\`${node.language ?? ""}\n${node.text ?? ""}\n\`\`\`\n`;
					break;
				case "img":
					if (node.image_key) imageKeys.push(node.image_key);
					break;
				default:
					break;
			}
		}
		lines.push(text.trimEnd());
	}

	return { text: lines.join("\n").trim(), imageKeys };
}

/**
 * 把一条飞书消息归一化为动态素材；不支持的形态返回 null。
 *
 * @param {Record<string, any>} item `im/v1/messages` 返回的消息项
 */
export function parseFeishuMessage(item) {
	if (!item || item.deleted) return null;
	// 机器人自己发出的消息不再回流成动态。
	if (item.sender?.sender_type === "app") return null;

	const id = String(item.message_id ?? "");
	const createTime = Number(item.create_time ?? 0);
	if (!id || !Number.isFinite(createTime) || createTime <= 0) return null;

	const payload = parseBody(item);
	if (!payload) return null;

	let text = "";
	let imageKeys = [];

	switch (item.msg_type) {
		case "text":
			text = applyMentions(payload.text, item.mentions);
			break;
		case "post": {
			const post = pickPostPayload(payload);
			if (!post) return null;
			const flattened = flattenPostBlocks(post.content);
			text = flattened.text;
			imageKeys = flattened.imageKeys;
			if (post.title) {
				text = text === "" ? String(post.title) : `${post.title}\n\n${text}`;
			}
			break;
		}
		case "image":
			imageKeys = payload.image_key ? [String(payload.image_key)] : [];
			break;
		default:
			return null;
	}

	// `/skip` 直接丢弃，连分组都不参与。
	if (SKIP_PREFIX.test(text)) return null;

	const draft = DRAFT_PREFIX.test(text);
	if (draft) text = text.replace(DRAFT_PREFIX, "").trim();

	if (text === "" && imageKeys.length === 0) return null;

	return {
		id,
		createTime,
		senderId: String(item.sender?.id ?? ""),
		draft,
		text,
		imageKeys,
	};
}

/**
 * 把同一发送者短时间内的连续消息合并成动态。
 *
 * 分组键始终是这一组第一条消息的 ID，因此重复轮询同一时间窗口会得到
 * 完全相同的文件名，天然幂等。
 *
 * @param {Array<ReturnType<typeof parseFeishuMessage>>} messages
 * @param {{ gapMs?: number, graceMs?: number, now?: number }} [options]
 */
export function groupFeishuMoments(messages, options = {}) {
	const gapMs = options.gapMs ?? 5 * 60 * 1000;
	const graceMs = options.graceMs ?? 0;
	const now = options.now ?? Date.now();

	const usable = messages
		.filter(Boolean)
		.slice()
		.sort((a, b) => a.createTime - b.createTime || a.id.localeCompare(b.id));

	const groups = [];
	let current = null;

	for (const message of usable) {
		// 图片可以并入前一条；文字只能并入「还没有正文」的组，避免两条独立文字被误合。
		const canMerge =
			current !== null &&
			current.senderId === message.senderId &&
			message.createTime - current.lastTime <= gapMs &&
			(message.text === "" || current.text === "");

		if (canMerge) {
			current.ids.push(message.id);
			current.lastTime = message.createTime;
			current.draft = current.draft || message.draft;
			if (message.text) {
				current.text =
					current.text === "" ? message.text : `${current.text}\n\n${message.text}`;
			}
			current.imageKeys.push(...message.imageKeys);
			continue;
		}

		current = {
			id: message.id,
			ids: [message.id],
			senderId: message.senderId,
			createTime: message.createTime,
			lastTime: message.createTime,
			draft: message.draft,
			text: message.text,
			imageKeys: [...message.imageKeys],
		};
		groups.push(current);
	}

	// 宽限期：刚发出的消息先等一会儿，避免文字先入库、图片落到下一条动态。
	const cutoff = now - graceMs;
	return groups.filter(
		(group) =>
			group.lastTime <= cutoff &&
			(group.text !== "" || group.imageKeys.length > 0),
	);
}

/** 取出消息末尾连续 hashtag 行，作为 tags；正文里其余 # 保持原样。 */
export function extractHashtags(text) {
	const lines = String(text ?? "").split(/\r?\n/);
	const tags = [];

	while (lines.length > 0) {
		const last = lines[lines.length - 1];
		if (!HASHTAG_LINE.test(last)) break;
		for (const token of last.match(HASHTAG_TOKEN) ?? []) {
			tags.push(token.slice(1));
		}
		lines.pop();
	}

	return { text: lines.join("\n").trim(), tags: [...new Set(tags)].slice(0, 8) };
}

/** 北京时间（无夏令时，固定 +08:00）。 */
export function toShanghaiIso(timestamp) {
	const shifted = new Date(timestamp + 8 * 60 * 60 * 1000);
	const pad = (value) => String(value).padStart(2, "0");
	const date = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
	const time = `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
	return `${date}T${time}+08:00`;
}

/** 用于文件名与归档目录的北京日期。 */
export function toShanghaiDate(timestamp) {
	return toShanghaiIso(timestamp).slice(0, 10);
}

function yamlScalar(value) {
	const text = String(value);
	return YAML_SAFE_SCALAR.test(text) ? text : JSON.stringify(text);
}

function safeId(id) {
	return String(id).replace(FEISHU_ID_PREFIX, "").replace(UNSAFE_FILE_CHARS, "");
}

/** 动态文件名：`2026-11-13-feishu-<消息ID>.md`。 */
export function momentFileName(group) {
	return `${toShanghaiDate(group.createTime)}-feishu-${safeId(group.id)}.md`;
}

/** 配图文件名：`2026-11-13-feishu-<消息ID>-<序号>.<ext>`。 */
export function momentImageFileName(group, index, extension) {
	return `${toShanghaiDate(group.createTime)}-feishu-${safeId(group.id)}-${index + 1}.${extension}`;
}

/**
 * 渲染可被 Astro moments collection 直接消费的 Markdown。
 *
 * @param {ReturnType<typeof groupFeishuMoments>[number]} group
 * @param {string[]} [imagePaths] 站内绝对路径（`/images/moments/feishu/...`）
 */
export function renderMomentMarkdown(group, imagePaths = []) {
	const { text, tags } = extractHashtags(group.text);
	const lines = ["---", `published: ${toShanghaiIso(group.createTime)}`];

	if (group.draft) lines.push("draft: true");

	if (tags.length > 0) {
		lines.push("tags:");
		for (const tag of tags) lines.push(`  - ${yamlScalar(tag)}`);
	}

	if (imagePaths.length > 0) {
		lines.push("images:");
		for (const src of imagePaths) {
			lines.push(`  - src: ${yamlScalar(src)}`);
			lines.push('    alt: ""');
		}
	}

	lines.push("---", "");
	if (text !== "") lines.push(text, "");

	return lines.join("\n");
}
