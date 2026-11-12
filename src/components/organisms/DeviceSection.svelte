<script lang="ts">
/**
 * 设备展示主体（有机体）：实时搜索 + 场景分类筛选
 * （带 LoadingIndicator 过渡）+ 等高网格。
 * - 筛选状态与搜索词同步 URL（?category= / ?q=），刷新/分享/回退保留；
 * - 网格按行等高，保证同一行卡片左右边缘与底部对齐。
 */
import Chips from "@components/atoms/action/Chips.svelte";
import Card from "@components/atoms/display/Card.svelte";
import LoadingIndicator from "@components/atoms/feedback/LoadingIndicator.svelte";
import TextField from "@components/atoms/input/TextField.svelte";
import DeviceCard from "@components/molecules/DeviceCard.svelte";
import PageHeader from "@components/molecules/PageHeader.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { onMount } from "svelte";
import type {
	DeviceCategory,
	DeviceItem,
	DeviceStatus,
} from "@/types/devicesConfig";

let {
	categories = [] as DeviceCategory[],
	items = [] as DeviceItem[],
	title = i18n(I18nKey.devices),
	subtitle = i18n(I18nKey.devicesBanner),
}: {
	categories?: DeviceCategory[];
	items?: DeviceItem[];
	title?: string;
	subtitle?: string;
} = $props();

let query = $state("");
let selectedCategory = $state("");
let initialized = false;

/** 筛选过渡三段态：loading 展示指示器 → out 指示器淡出 → idle 列表 stagger 揭幕 */
type FilterPhase = "idle" | "loading" | "out";
let phase = $state<FilterPhase>("idle");
let phaseTimers: ReturnType<typeof setTimeout>[] = [];

const enabledItems = $derived(items.filter((item) => item.enable !== false));
const activeCategories = $derived(
	categories.filter((category) =>
		enabledItems.some((item) => item.category === category.key),
	),
);

/** 场景分类筛选：仅展示存在设备的分类（无“全部”按钮，空选=全部） */
const categoryChipItems = $derived(
	activeCategories.map((category) => ({
		value: category.key,
		label: category.label,
		leadingIcon: category.icon ?? "",
	})),
);

/** 状态展示优先级：主力在役 → 备用设备 → 心愿清单 → 退役收藏 */
const STATUS_ORDER: Record<DeviceStatus, number> = {
	active: 0,
	backup: 1,
	wishlist: 2,
	archived: 3,
};

/** 筛选后先推荐置顶，再按状态优先级排序；同级保持数据源原有顺序 */
const filteredItems = $derived.by(() => {
	const normalized = query.trim().toLowerCase();
	return enabledItems
		.filter((item) => {
			if (selectedCategory && item.category !== selectedCategory) return false;
			if (!normalized) return true;
			return [
				item.name,
				item.brand,
				item.specs,
				item.description,
				item.year ?? "",
			].some((val) => val.toLowerCase().includes(normalized));
		})
		.sort((a, b) => {
			const featuredDelta =
				Number(Boolean(b.featured)) - Number(Boolean(a.featured));
			if (featuredDelta !== 0) return featuredDelta;
			return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
		});
});

/** 任一筛选变化：指示器展示 → 淡出 → 网格 stagger 揭幕 */
function onFilterChange() {
	phaseTimers.forEach(clearTimeout);
	phase = "loading";
	phaseTimers = [
		setTimeout(() => {
			phase = "out";
		}, 300),
		setTimeout(() => {
			phase = "idle";
		}, 300 + 150),
	];
}

// URL 参数同步（?category= / ?q=）
$effect(() => {
	const c = selectedCategory;
	const q = query;
	if (!initialized) return;
	const params = new URLSearchParams(window.location.search);
	params.delete("category");
	params.delete("q");
	if (c) params.set("category", c);
	if (q.trim()) params.set("q", q.trim());
	const qs = params.toString();
	history.replaceState(
		history.state,
		"",
		qs ? `?${qs}` : window.location.pathname,
	);
});

onMount(() => {
	const params = new URLSearchParams(window.location.search);
	selectedCategory = params.get("category") || "";
	query = params.get("q") || "";
	initialized = true;

	return () => {
		phaseTimers.forEach(clearTimeout);
	};
});
</script>

<Card color="var(--card-bg)" radius="l" class="devices-section px-8 py-6">
	<PageHeader
		icon="material-symbols:devices-rounded"
		{title}
		{subtitle}
	/>

	{#if enabledItems.length > 0}
		<div class="devices-section__tools">
			<div class="devices-section__search-row">
				<div class="devices-section__search">
					<TextField
						type="search"
						bind:value={query}
						placeholder={i18n(I18nKey.devicesSearchPlaceholder)}
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
							class="devices-section__search-clear"
							aria-label={i18n(I18nKey.clear)}
							onclick={() => (query = "")}
						>
							<Icon icon="material-symbols:close-rounded" aria-hidden="true" />
						</button>
					{/if}
				</div>
			</div>

			<div class="devices-section__filter-row">
				<div class="devices-section__chips" aria-label={i18n(I18nKey.devicesCategoryLabel)}>
					<Chips
						items={categoryChipItems}
						variant="filter"
						bind:value={selectedCategory}
						onchange={onFilterChange}
					/>
				</div>
				{#if filteredItems.length > 0}
					<p class="devices-section__count" aria-live="polite">
						{filteredItems.length} {i18n(I18nKey.devicesCounts)}
					</p>
				{/if}
			</div>
		</div>
	{/if}

	{#if phase !== "idle"}
		<!-- 筛选过渡：contained 指示器展示后淡出，再由网格 stagger 揭幕 -->
		<div
			class="devices-section__loading"
			class:devices-section__loading--out={phase === "out"}
		>
			<LoadingIndicator contained size={64} />
		</div>
	{:else if filteredItems.length > 0}
		{#key `${selectedCategory}|${query}`}
			<div
				class="devices-section__grid"
				aria-live="polite"
			>
				{#each filteredItems as device, index (device.id)}
					<DeviceCard {device} delay={Math.min(index, 7) * 45} />
				{/each}
			</div>
		{/key}
	{:else}
		<div class="devices-section__empty">
			<Icon icon="material-symbols:devices-off-outline-rounded" aria-hidden="true" />
			<span>{i18n(I18nKey.devicesNoResults)}</span>
		</div>
	{/if}
</Card>

<style lang="stylus">
@import "../../styles/breakpoints.styl"

.devices-section
	display: block

	@media (max-width: bp-sm - 1px)
		padding: 1rem 0.75rem

	&__tools
		display: flex
		flex-direction: column
		gap: 0.75rem
		padding-bottom: 1.25rem
		border-bottom: 1px solid var(--outline-variant)

	&__search-row
		display: flex
		align-items: center
		width: 100%

	&__search
		position: relative
		width: 100%
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

	&__filter-row
		display: flex
		flex-wrap: wrap
		align-items: center
		gap: 0.75rem
		width: 100%

	&__chips
		flex: 1
		min-width: 0
		max-width: 100%
		overflow-x: auto
		scrollbar-width: none
		&::-webkit-scrollbar
			display: none

	&__count
		margin: 0
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)
		white-space: nowrap

	/* 筛选过渡：大号 contained LoadingIndicator（out = 淡出退场） */
	&__loading
		display: flex
		align-items: center
		justify-content: center
		min-height: 11rem
		padding-top: 1.5rem

		&--out
			animation: devices-loading-out var(--m3e-duration-short) var(--m3e-easing-emphasized-accelerate) both

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

	&__grid
		display: grid
		grid-template-columns: minmax(0, 1fr)
		gap: 0.75rem
		margin-top: 1.25rem

		/* 等高网格：同一行卡片顶部、底部与左右边缘对齐 */
		@media (min-width: bp-md)
			grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr))
			align-items: stretch
			column-gap: var(--m3e-space-4)
			row-gap: 0.75rem

/* 指示器退场：淡出 + 轻微收拢（reduced-motion 由全局规则压至终态） */
@keyframes devices-loading-out
	from
		opacity: 1
		transform: none
	to
		opacity: 0
		transform: scale(0.96)
</style>
