import { buildAtomXml, getFeedPosts } from "@utils/feed";
import type { APIContext } from "astro";
import { profileConfig, siteConfig } from "@/config";

export async function GET(context: APIContext): Promise<Response> {
	// 子路径部署时 feed 的 siteUrl / self 链接也必须带上 base 路径
	const site = new URL(
		import.meta.env.BASE_URL,
		context.site ?? new URL(siteConfig.site),
	);
	const posts = await getFeedPosts(site);

	const xml = buildAtomXml({
		title: siteConfig.title,
		subtitle: siteConfig.subtitle || "No description",
		lang: siteConfig.lang,
		author: profileConfig.name,
		siteUrl: site.href,
		feedUrl: new URL("atom.xml", site).href,
		items: posts,
	});

	return new Response(xml, {
		headers: {
			"Content-Type": "application/atom+xml; charset=utf-8",
		},
	});
}
