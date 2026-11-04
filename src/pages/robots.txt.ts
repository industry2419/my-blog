import type { APIRoute } from "astro";

// 站点可能部署在子路径（如 GitHub Pages 的 /my-blog/），
// 因此 sitemap 地址必须带上 import.meta.env.BASE_URL，否则会指向域名根目录。
const siteWithBase = new URL(import.meta.env.BASE_URL, import.meta.env.SITE);

const robotsTxt = `
User-agent: *
Disallow: /_astro/

Sitemap: ${new URL("sitemap-index.xml", siteWithBase).href}
`.trim();

export const GET: APIRoute = () => {
	return new Response(robotsTxt, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
