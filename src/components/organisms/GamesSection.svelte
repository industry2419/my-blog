<script lang="ts">
/**
 * 游戏展示主体（有机体）：按数据来源分组（miHoYo / Steam）+ 页内搜索。
 *
 * - 搜索只过滤本区块内的游戏，不会触发站点级 Pagefind 搜索；
 * - 搜索词同步 URL（?q=），刷新/分享/回退保留；
 * - 每个来源分组独立统计条目数，Steam 组额外展示总时长；
 * - 网格采用拉伸对齐（landscape 卡片同高等宽成行），与设备页的瀑布流
 *   打包刻意区分；卡片分别为 credentials 的 GameCard 与 SteamGameCard。
 */
import Button from "@components/atoms/action/Button.svelte";
import Card from "@components/atoms/display/Card.svelte";
import TextField from "@components/atoms/input/TextField.svelte";
import SegmentedButton from "@components/atoms/selection/SegmentedButton.svelte";
import GameCard from "@components/molecules/GameCard.svelte";
import PageHeader from "@components/molecules/PageHeader.svelte";
import SteamGameCard from "@components/molecules/SteamGameCard.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { onMount } from "svelte";
import type {
	GameItem,
	SteamLibrary,
} from "@/types/gamesConfig";

let {
	items = [] as GameItem[],
	steamLibrary = { fetchedAt: "", games: [] } as SteamLibrary,
	title = i18n(I18nKey.games),
	subtitle = i18n(I18nKey.gamesBanner),
}: {
	items?: GameItem[];
	steamLibrary?: SteamLibrary;
	title?: string;
	subtitle?: string;
} = $props();

let query = $state("");
let initialized = false;

// 每行卡片数：仅影响本页布局，偏好保存在本机。
const COLUMNS_KEY = "shirone:games-columns";
const COLUMN_OPTIONS = ["2", "3", "4"];
const COLUMN_OPTIONS_UI = COLUMN_OPTIONS.map((value) => ({ value, label: value }));
let columns = $state("3");
const gridColumns = $derived(
	COLUMN_OPTIONS.includes(columns) ? columns : "3",
);

const enabledItems = $derived(items.filter((item) => item.enable !== false));
const steamGames = $derived(
	steamLibrary.games.filter((game) => game.name.trim().length > 0),
);
const normalizedQuery = $derived(query.trim().toLowerCase());

const filteredItems = $derived(
	normalizedQuery
		? enabledItems.filter((item) =>
				[
					item.name,
					item.developer,
					item.platform ?? "",
					item.year ?? "",
					item.description,
					...(item.tags ?? []),
				].some((value) => value.toLowerCase().includes(normalizedQuery)),
			)
		: enabledItems,
);

const filteredSteamGames = $derived(
	normalizedQuery
		? steamGames.filter((game) =>
				game.name.toLowerCase().includes(normalizedQuery),
			)
		: steamGames,
);

// Steam 区默认只露两排，其余折叠；搜索时直接给出全部命中，避免结果被截断
let steamExpanded = $state(false);
const steamVisibleCount = $derived(Number(gridColumns) * 2);
const steamHasMore = $derived(
	filteredSteamGames.length > steamVisibleCount,
);
const visibleSteamGames = $derived(
	steamExpanded || normalizedQuery
		? filteredSteamGames
		: filteredSteamGames.slice(0, steamVisibleCount),
);

const totalCount = $derived(filteredItems.length + filteredSteamGames.length);
const totalGames = $derived(enabledItems.length + steamGames.length);

// 「近两周」只在快照足够新时展示，避免旧快照给出过期结论。
const showRecent = $derived.by(() => {
	const fetchedTime = steamLibrary.fetchedAt
		? new Date(steamLibrary.fetchedAt).getTime()
		: Number.NaN;
	return (
		!Number.isNaN(fetchedTime) &&
		Date.now() - fetchedTime <= 14 * 24 * 60 * 60 * 1000
	);
});

const filteredSteamHours = $derived(
	Math.round(
		filteredSteamGames.reduce((total, game) => total + game.minutes, 0) / 60,
	),
);

// URL 参数同步（?q=）
$effect(() => {
	const value = query;
	if (!initialized) return;
	const params = new URLSearchParams(window.location.search);
	params.delete("category");
	if (value.trim()) {
		params.set("q", value.trim());
	} else {
		params.delete("q");
	}
	const qs = params.toString();
	history.replaceState(
		history.state,
		"",
		qs ? `?${qs}` : window.location.pathname,
	);
});

// 每行卡片数偏好（仅本机）
$effect(() => {
	const value = columns;
	if (!initialized) return;
	try {
		localStorage.setItem(COLUMNS_KEY, value);
	} catch {
		/* Ignore local storage access failure */
	}
});

onMount(() => {
	const params = new URLSearchParams(window.location.search);
	query = params.get("q") || "";
	try {
		const stored = localStorage.getItem(COLUMNS_KEY);
		if (stored && COLUMN_OPTIONS.includes(stored)) columns = stored;
	} catch {
		/* Ignore local storage access failure */
	}
	initialized = true;
});
</script>

<div data-pagefind-body>
	<Card color="var(--card-bg)" radius="l" class="px-4 py-4 sm:px-8 sm:py-6">
		<PageHeader
			icon="material-symbols:sports-esports-outline-rounded"
			{title}
			{subtitle}
		/>

		{#if totalGames > 0}
			<div class="games-section__tools">
				<div class="games-section__search">
					<TextField
						type="search"
						bind:value={query}
						placeholder={i18n(I18nKey.gamesSearchPlaceholder)}
						label={i18n(I18nKey.search)}
						hideLabel
						variant="outlined"
						class="!rounded-(--shape-corner-l)"
					>
						<Icon slot="leading" icon="material-symbols:search-rounded" aria-hidden="true" />
					</TextField>
					{#if query}
						<button
							type="button"
							class="games-section__search-clear"
							aria-label={i18n(I18nKey.clear)}
							onclick={() => (query = "")}
						>
							<Icon icon="material-symbols:close-rounded" aria-hidden="true" />
						</button>
					{/if}
				</div>
				<div class="games-section__view">
					<p class="games-section__count" aria-live="polite">
						{totalCount} {i18n(I18nKey.gamesCounts)}
					</p>
					<div class="games-section__columns">
						<SegmentedButton
							label={i18n(I18nKey.gamesColumnsLabel)}
							options={COLUMN_OPTIONS_UI}
							bind:value={columns}
						/>
					</div>
				</div>
			</div>
		{/if}

		{#if totalCount > 0}
			{#if filteredItems.length > 0}
				<section class="games-section__group" aria-labelledby="games-group-mihoyo">
					<header class="games-section__group-header">
						<span class="games-section__group-icon" aria-hidden="true">
							<Icon icon="material-symbols:sports-esports-outline-rounded" />
						</span>
						<h2 class="games-section__group-title" id="games-group-mihoyo">
							{i18n(I18nKey.gamesSourceMihoyo)}
						</h2>
						<span class="games-section__group-count">
							{filteredItems.length}
							{i18n(I18nKey.gamesCounts)}
						</span>
					</header>
					<div
						class="games-section__grid"
						style={`--games-columns: ${gridColumns}`}
					>
						{#each filteredItems as game, index (game.id)}
							<GameCard {game} delay={Math.min(index, 7) * 45} />
						{/each}
					</div>
				</section>
			{/if}

			{#if filteredSteamGames.length > 0}
				<section class="games-section__group" aria-labelledby="games-group-steam">
					<header class="games-section__group-header">
						<span class="games-section__group-icon" aria-hidden="true">
							<Icon icon="simple-icons:steam" />
						</span>
						<h2 class="games-section__group-title" id="games-group-steam">
							{i18n(I18nKey.gamesSourceSteam)}
						</h2>
						<span class="games-section__group-count">
							{filteredSteamGames.length}
							{i18n(I18nKey.gamesCounts)}
							<span aria-hidden="true">·</span>
							{filteredSteamHours}
							{i18n(I18nKey.gamesHours)}
						</span>
					</header>
					<div
						class="games-section__grid"
						style={`--games-columns: ${gridColumns}`}
					>
						{#each visibleSteamGames as game (game.appId)}
							<SteamGameCard {game} {showRecent} />
						{/each}
					</div>
					{#if steamHasMore && !normalizedQuery}
						<div class="games-section__more">
							<Button
								variant="text"
								onclick={() => (steamExpanded = !steamExpanded)}
							>
								{steamExpanded
									? i18n(I18nKey.gamesShowLess)
									: i18n(I18nKey.gamesShowAll)}
								<Icon
									icon={steamExpanded
										? "material-symbols:expand-less-rounded"
										: "material-symbols:expand-more-rounded"}
									aria-hidden="true"
								/>
							</Button>
						</div>
					{/if}
				</section>
			{/if}
		{:else}
			<div class="games-section__empty">
				<Icon icon="material-symbols:sports-esports-outline-rounded" aria-hidden="true" />
				<span>{i18n(I18nKey.gamesNoResults)}</span>
			</div>
		{/if}
	</Card>
</div>

<style lang="stylus">
@import "../../styles/breakpoints.styl"

.games-section
	&__tools
		display: flex
		flex-wrap: wrap
		align-items: center
		gap: 0.75rem
		padding-bottom: 1.25rem
		border-bottom: 1px solid var(--outline-variant)

	&__search
		position: relative
		flex: 1
		min-width: 0
		max-width: 32rem

		:global(.m3-text-field)
			width: 100%

	&__search-clear
		position: absolute
		right: 0.5rem
		top: 50%
		transform: translateY(-50%)
		display: inline-flex
		flex-shrink: 0
		align-items: center
		justify-content: center
		width: 1.75rem
		height: 1.75rem
		padding: 0.25rem
		border: none
		background: none
		color: var(--on-surface-variant)
		cursor: pointer
		border-radius: var(--shape-corner-full)
		> :global(svg)
			width: 1.25rem
			height: 1.25rem
		&:hover
			background: unquote("color-mix(in oklab, var(--on-surface-variant) 8%, transparent)")

	&__view
		display: flex
		align-items: center
		gap: 0.75rem
		margin-left: auto
		flex-shrink: 0

	&__count
		margin: 0
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)
		white-space: nowrap

	/* 列数切换只在多列布局（≥md）下有意义，移动端单列时隐藏 */
	&__columns
		display: none

		@media (min-width: bp-md)
			display: flex

	&__group
		margin-top: 1.5rem

	&__group-header
		display: flex
		flex-wrap: wrap
		align-items: center
		gap: 0.625rem

	&__group-icon
		display: inline-flex
		align-items: center
		justify-content: center
		width: 2rem
		height: 2rem
		border-radius: var(--shape-corner-full)
		background: var(--surface-container-high)
		color: var(--primary)
		flex-shrink: 0

		> :global(svg)
			width: 1.25rem
			height: 1.25rem

	&__group-title
		margin: 0
		color: var(--on-surface)
		font: var(--m3e-type-title-medium)

	&__group-count
		margin-left: auto
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)
		white-space: nowrap

	&__empty
		display: flex
		flex-direction: column
		align-items: center
		justify-content: center
		gap: 0.875rem
		min-height: 12rem
		padding-top: 1.5rem
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-large)

		> :global(svg)
			width: 2.75rem
			height: 2.75rem
			color: var(--outline)

	/* 横屏卡片网格：单列移动端起步，≥md 多列等高成行 */
	&__grid
		display: grid
		grid-template-columns: minmax(0, 1fr)
		gap: var(--m3e-space-4)
		margin-top: 1rem
		align-items: stretch

		@media (min-width: bp-md)
			grid-template-columns: repeat(var(--games-columns, 3), minmax(0, 1fr))

	/* 折叠区「展开全部 / 收起」：居中文字按钮，图标跟在文案后 */
	&__more
		display: flex
		justify-content: center
		margin-top: 0.75rem

		:global(.m3-button__content > svg)
			width: 1.25rem
			height: 1.25rem
</style>
