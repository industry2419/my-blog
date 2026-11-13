import assert from "node:assert/strict";
import { test } from "node:test";
import {
	extractHashtags,
	groupFeishuMoments,
	momentFileName,
	momentImageFileName,
	parseFeishuMessage,
	renderMomentMarkdown,
	toShanghaiIso,
} from "../scripts/moments/feishu-parse.mjs";

const T0 = 1_700_000_000_000;

function textMessage(text, overrides = {}) {
	return {
		message_id: "om_text001",
		msg_type: "text",
		create_time: String(T0),
		sender: { id: "ou_user", sender_type: "user" },
		body: { content: JSON.stringify({ text }) },
		...overrides,
	};
}

function imageMessage(imageKey, overrides = {}) {
	return {
		message_id: "om_img001",
		msg_type: "image",
		create_time: String(T0 + 60_000),
		sender: { id: "ou_user", sender_type: "user" },
		body: { content: JSON.stringify({ image_key: imageKey }) },
		...overrides,
	};
}

test("text 消息解析并还原 @ 提及", () => {
	const message = parseFeishuMessage(
		textMessage("你好 @_user_1，今天好热", {
			mentions: [{ key: "@_user_1", name: "张三" }],
		}),
	);

	assert.equal(message.text, "你好 @张三，今天好热");
	assert.equal(message.draft, false);
	assert.deepEqual(message.imageKeys, []);
});

test("/draft 写入草稿，/skip 直接丢弃", () => {
	const draft = parseFeishuMessage(textMessage("/draft 只有草稿才能看到"));
	assert.equal(draft.draft, true);
	assert.equal(draft.text, "只有草稿才能看到");

	assert.equal(parseFeishuMessage(textMessage("/skip 不发布")), null);
});

test("富文本消息拍平文字、链接与图片", () => {
	const message = parseFeishuMessage({
		message_id: "om_post01",
		msg_type: "post",
		create_time: String(T0),
		sender: { id: "ou_user", sender_type: "user" },
		body: {
			content: JSON.stringify({
				title: "周末",
				content: [
					[
						{ tag: "text", text: "去" },
						{ tag: "a", text: "江边", href: "https://example.com/river" },
					],
					[{ tag: "img", image_key: "img_v2_a" }],
				],
			}),
		},
	});

	assert.equal(message.text, "周末\n\n去[江边](https://example.com/river)");
	assert.deepEqual(message.imageKeys, ["img_v2_a"]);
});

test("机器人自己发送的消息不回流", () => {
	const message = parseFeishuMessage(
		textMessage("我是一条通知", { sender: { id: "cli_bot", sender_type: "app" } }),
	);
	assert.equal(message, null);
});

test("相邻的图片消息合并进同一条动态", () => {
	const groups = groupFeishuMoments(
		[
			parseFeishuMessage(textMessage("今天的光很好")),
			parseFeishuMessage(imageMessage("img_v2_a")),
			parseFeishuMessage(imageMessage("img_v2_b", { message_id: "om_img002" })),
		],
		{ now: T0 + 3_600_000, graceMs: 0 },
	);

	assert.equal(groups.length, 1);
	assert.equal(groups[0].text, "今天的光很好");
	assert.deepEqual(groups[0].imageKeys, ["img_v2_a", "img_v2_b"]);
});

test("先发图片再补文字也能合并成一条", () => {
	const groups = groupFeishuMoments(
		[
			parseFeishuMessage(imageMessage("img_v2_d")),
			parseFeishuMessage(
				textMessage("补一句说明", {
					message_id: "om_text002",
					create_time: String(T0 + 120_000),
				}),
			),
		],
		{ now: T0 + 3_600_000, graceMs: 0 },
	);

	assert.equal(groups.length, 1);
	assert.equal(groups[0].text, "补一句说明");
	assert.deepEqual(groups[0].imageKeys, ["img_v2_d"]);
});

test("超出合并窗口的消息成为独立动态", () => {
	const groups = groupFeishuMoments(
		[
			parseFeishuMessage(textMessage("第一条")),
			parseFeishuMessage(
				imageMessage("img_v2_c", { create_time: String(T0 + 30 * 60_000) }),
			),
		],
		{ now: T0 + 3_600_000, graceMs: 0, gapMs: 5 * 60_000 },
	);

	assert.equal(groups.length, 2);
	assert.equal(groups[1].text, "");
	assert.deepEqual(groups[1].imageKeys, ["img_v2_c"]);
});

test("宽限期内的新消息暂不发布", () => {
	const groups = groupFeishuMoments([parseFeishuMessage(textMessage("刚发的"))], {
		now: T0 + 60_000,
		graceMs: 10 * 60_000,
	});
	assert.equal(groups.length, 0);
});

test("末尾 hashtag 行进 tags，正文不再重复", () => {
	const result = extractHashtags("下班了\n\n#日常 #随笔");
	assert.equal(result.text, "下班了");
	assert.deepEqual(result.tags, ["日常", "随笔"]);

	// Markdown 标题不是 hashtag。
	const heading = extractHashtags("# 标题\n正文");
	assert.deepEqual(heading.tags, []);
});

test("渲染出 Astro moments 可直接消费的 frontmatter", () => {
	const [group] = groupFeishuMoments([parseFeishuMessage(textMessage("图文测试\n\n#日常"))], {
		now: T0 + 3_600_000,
		graceMs: 0,
	});
	const markdown = renderMomentMarkdown(group, [
		"/images/moments/feishu/2023-11-15-feishu-text001-1.jpg",
	]);

	assert.match(markdown, /^---\n/);
	assert.match(markdown, /published: 2023-11-15T06:13:20\+08:00/);
	assert.match(markdown, /\n  - 日常\n/);
	assert.match(markdown, /  - src: \/images\/moments\/feishu\/2023-11-15-feishu-text001-1\.jpg/);
	assert.match(markdown, /\n---\n\n图文测试\n$/);
});

test("文件名由北京日期与消息 ID 决定，重复轮询保持一致", () => {
	const [group] = groupFeishuMoments([parseFeishuMessage(textMessage("稳定"))], {
		now: T0 + 3_600_000,
		graceMs: 0,
	});

	assert.equal(momentFileName(group), "2023-11-15-feishu-text001.md");
	assert.equal(momentImageFileName(group, 0, "png"), "2023-11-15-feishu-text001-1.png");
	assert.equal(toShanghaiIso(T0), "2023-11-15T06:13:20+08:00");
});
