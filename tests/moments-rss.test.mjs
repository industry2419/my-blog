import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	decodeXmlEntities,
	htmlToPlainText,
	parseBilibiliDynamicFeed,
} from "../scripts/moments/rss.mjs";

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>宫夜的动态</title>
    <item>
      <title>第一条动态</title>
      <link>https://t.bilibili.com/1111111111111111111</link>
      <guid isPermaLink="false">https://t.bilibili.com/1111111111111111111</guid>
      <pubDate>Fri, 13 Nov 2026 10:00:00 GMT</pubDate>
      <description>&lt;p&gt;今天&lt;br&gt;[图片]&lt;img src="//i0.hdslb.com/a.png"&gt;去看&lt;a href="https://example.com"&gt;展&lt;/a&gt;&lt;/p&gt;</description>
    </item>
    <item>
      <title>第二条动态</title>
      <link>https://t.bilibili.com/2222222222222222222</link>
      <guid isPermaLink="false">https://t.bilibili.com/2222222222222222222</guid>
      <pubDate>Thu, 12 Nov 2026 09:30:00 GMT</pubDate>
      <description><![CDATA[<p>只有图片</p><img src="http://i1.hdslb.com/b.png">]]></description>
    </item>
    <item>
      <title>重复条目</title>
      <link>https://t.bilibili.com/1111111111111111111</link>
      <guid isPermaLink="false">https://t.bilibili.com/1111111111111111111</guid>
      <pubDate>Wed, 11 Nov 2026 09:30:00 GMT</pubDate>
      <description>重复内容</description>
    </item>
  </channel>
</rss>`;

describe("B 站动态 Feed 解析", () => {
	it("按时间倒序解析、去重并生成稳定 ID", () => {
		const items = parseBilibiliDynamicFeed(FEED, {
			now: new Date("2026-11-13T00:00:00.000Z"),
		});

		assert.equal(items.length, 2);
		assert.deepEqual(
			items.map((item) => item.id),
			["bili-1111111111111111111", "bili-2222222222222222222"],
		);
		assert.equal(items[0].published, "2026-11-13T10:00:00.000Z");
	});

	it("把转义 HTML 还原为带段落的纯文本", () => {
		const [first] = parseBilibiliDynamicFeed(FEED);
		assert.equal(first.content, "今天\n去看[展](https://example.com)");
	});

	it("提取配图并统一为 HTTPS", () => {
		const items = parseBilibiliDynamicFeed(FEED);
		assert.deepEqual(items[0].images, ["https://i0.hdslb.com/a.png"]);
		assert.deepEqual(items[1].images, ["https://i1.hdslb.com/b.png"]);
	});

	it("CDATA 正文与空 Feed 都能安全处理", () => {
		const items = parseBilibiliDynamicFeed(FEED);
		assert.equal(items[1].content, "只有图片");
		assert.deepEqual(parseBilibiliDynamicFeed(""), []);
	});

	it("实体只解码一次，避免二次解码出标签", () => {
		assert.equal(decodeXmlEntities("&amp;lt;b&amp;gt;"), "&lt;b&gt;");
		assert.equal(htmlToPlainText("a&nbsp;b"), "a b");
	});
});
