import { expect, test } from "@playwright/test";
import { registerPersistentShellSync } from "./feature-page";

const GAME_COUNT = 3;

test.describe("游戏展示页", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/games/");
		await expect(page.locator(".game-card")).toHaveCount(GAME_COUNT);
	});

	test("渲染页面标题、游戏卡片与资历徽章", async ({ page }) => {
		await expect(page.locator("#swup-container")).toHaveAttribute(
			"data-current-page",
			"games",
		);
		await expect(page.locator(".page-header__title")).not.toBeEmpty();
		await expect(page.locator(".games-section__count")).toContainText("3");

		const genshin = page.locator('[data-game="genshin-impact"]');
		await expect(genshin.locator("h2")).toHaveText("原神");
		await expect(genshin.locator(".game-card__developer")).toHaveText("miHoYo");
		await expect(genshin.locator(".game-card__platform")).toContainText(
			"PC / 移动端",
		);
		await expect(genshin.locator(".game-card__year")).toHaveText("2020");
		await expect(genshin.locator(".game-card__tag").first()).toHaveText(
			"Open World",
		);
		await expect(page.locator('[data-status="playing"]')).toHaveCount(
			GAME_COUNT,
		);

		// 资历徽章只来自快照/手填，且 uid 与区服不得进入 DOM
		const credentialKinds = await genshin
			.locator("[data-credential-kind]")
			.evaluateAll((nodes) =>
				nodes.map((node) => node.getAttribute("data-credential-kind")),
			);
		expect(credentialKinds).toEqual(["level", "achievements", "challenge"]);
		await expect(
			page.locator(
				":text-matches('238563185|116319739|29161154|cn_gf01|prod_gf_cn')",
			),
		).toHaveCount(0);

		// 旧的两款游戏已移除，也不再存在精选卡片
		await expect(page.locator('[data-game="minecraft"]')).toHaveCount(0);
		await expect(
			page.locator('[data-game="nte-neverness-to-everness"]'),
		).toHaveCount(0);
		await expect(page.locator(".game-card--featured")).toHaveCount(0);
	});

	test("直接加载时导航高亮与侧栏页面过滤正确", async ({ page }) => {
		await expect(
			page.locator('a[data-nav-key="games"]').first(),
		).toHaveAttribute("aria-current", "page");
		await expect(
			page.locator('widget-layout[data-id="categories"]'),
		).toBeVisible();
		await expect(page.locator('widget-layout[data-id="tags"]')).toBeVisible();
	});

	test("分类筛选同步剩余游戏与计数（含 LoadingIndicator 过渡）", async ({
		page,
	}) => {
		// 已无条目的分类不渲染 chips
		await expect(
			page.getByRole("button", { name: "开放世界", exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "沙盒建造", exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "休闲派对", exact: true }),
		).toHaveCount(0);

		await page.getByRole("button", { name: "角色扮演", exact: true }).click();
		await expect(
			page.locator(".games-section__loading .m3-loading--contained"),
		).toBeVisible();
		await expect(page.locator(".game-card")).toHaveCount(2);
		await expect(page.locator(".games-section__count")).toContainText("2");
		await expect(page.locator('[data-game="genshin-impact"]')).toBeVisible();
		await expect(
			page.locator('[data-game="honkai-star-rail"]'),
		).toBeVisible();
		await expect(
			page.locator('[data-game="zenless-zone-zero"]'),
		).toHaveCount(0);
		await expect(page.locator(".games-section__loading")).toHaveCount(0);

		// 再次点击已选分类取消筛选，恢复全部
		await page.getByRole("button", { name: "角色扮演", exact: true }).click();
		await expect(page.locator(".game-card")).toHaveCount(GAME_COUNT);
	});

	test("搜索无结果时展示空状态反馈", async ({ page }) => {
		const searchInput = page.locator(".games-section__search input");
		await searchInput.fill("Unknown9999");
		await expect(page.locator(".game-card")).toHaveCount(0);
		await expect(page.locator(".games-section__empty")).toBeVisible();
	});

	test("实时搜索过滤与清除（URL ?q= 同步）", async ({ page }) => {
		const searchInput = page.locator(".games-section__search input");
		await expect(searchInput).toBeVisible();
		await searchInput.fill("Open World");
		await expect(page.locator(".game-card")).toHaveCount(1);
		await expect(page.locator('[data-game="genshin-impact"]')).toBeVisible();
		await expect(page).toHaveURL(/[?&]q=/);

		// 清除搜索恢复全部
		const clearBtn = page.locator(".games-section__search-clear");
		await clearBtn.click();
		await expect(page.locator(".game-card")).toHaveCount(GAME_COUNT);
		await expect(page).not.toHaveURL(/q=/);
	});

	test("URL 参数刷新后恢复筛选状态", async ({ page }) => {
		await page.getByRole("button", { name: "角色扮演", exact: true }).click();
		await expect(page).toHaveURL(/[?&]category=rpg/);
		await expect(page.locator(".game-card")).toHaveCount(2);
		await expect(page.locator('[data-game="genshin-impact"]')).toBeVisible();

		// 刷新后恢复同一次筛选
		await page.reload();
		await expect(page.locator(".game-card")).toHaveCount(2);
		await expect(page.locator('[data-game="genshin-impact"]')).toBeVisible();
		await expect(
			page.getByRole("button", { name: "角色扮演", exact: true }),
		).toHaveAttribute("aria-pressed", "true");
	});
});

test.describe("游戏展示页 Swup 导航", () => {
	test.use({ viewport: { width: 1280, height: 900 } });

	registerPersistentShellSync("从持久顶栏进入后同步页面、导航与侧栏状态", {
		key: "games",
		fromPath: "/skills/",
		toPath: /\/games\/$/,
		cardSelector: "game-card",
		cardCount: GAME_COUNT,
	});
});
