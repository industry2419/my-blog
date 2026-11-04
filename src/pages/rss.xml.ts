import rss from "@astrojs/rss";
import { getFeedPosts } from "@utils/feed";
import type { APIContext } from "astro";
import { siteConfig } from "@/config";

export async function GET(context: APIContext): Promise<Response> {
	// 子路径部署时 channel 的 <link> 也必须带上 base 路径
	const site = new URL(
		import.meta.env.BASE_URL,
		context.site ?? new URL(siteConfig.site),
	);
	const posts = await getFeedPosts(site);

	return rss({
		title: siteConfig.title,
		description: siteConfig.subtitle || "No description",
		site: site.href,
		items: posts.map((post) => ({
			title: post.title,
			pubDate: post.pubDate,
			description: post.description,
			link: post.link,
			content: post.contentHtml,
		})),
		customData: `<language>${siteConfig.lang}</language>`,
	});
}
