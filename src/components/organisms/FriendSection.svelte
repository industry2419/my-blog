<script lang="ts">
import Chips from "@components/atoms/action/Chips.svelte";
import IconButton from "@components/atoms/action/IconButton.svelte";
import Avatar from "@components/atoms/display/Avatar.svelte";
import Card from "@components/atoms/display/Card.svelte";
import LoadingIndicator from "@components/atoms/feedback/LoadingIndicator.svelte";
import TextField from "@components/atoms/input/TextField.svelte";
import FriendCard from "@components/molecules/FriendCard.svelte";
import PageHeader from "@components/molecules/PageHeader.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { showSnackbar } from "@utils/snackbar";
import { onDestroy, onMount } from "svelte";
import type { FriendItem } from "../../data/friends";

interface FriendContact {
	icon: string;
	label: string;
	value: string;
	href: string;
}

let {
	friends = [] as FriendItem[],
	title = i18n(I18nKey.friends),
	subtitle = i18n(I18nKey.friendsBanner),
	siteName = "",
	siteDescription = "",
	siteUrl = "",
	avatarUrl = "",
	avatarAbsoluteUrl = "",
	contacts = [] as FriendContact[],
}: {
	friends?: FriendItem[];
	title?: string;
	subtitle?: string;
	siteName?: string;
	siteDescription?: string;
	siteUrl?: string;
	avatarUrl?: string;
	avatarAbsoluteUrl?: string;
	contacts?: FriendContact[];
} = $props();

let query = $state("");
let selectedTag = $state("");
let initialized = false;
/** 标签筛选过渡三段态：loading 展示指示器 → out 指示器淡出 → idle 列表揭幕（与动态页同语言） */
type FilterPhase = "idle" | "loading" | "out";
let phase = $state<FilterPhase>("idle");
let phaseTimers: ReturnType<typeof setTimeout>[] = [];

const tagItems = $derived(
	Array.from(new Set(friends.flatMap((friend) => friend.tags)))
		.sort((a, b) => a.localeCompare(b))
		.map((tag) => ({ value: tag, label: tag })),
);

const filtered = $derived.by(() => {
	const normalizedQuery = query.trim().toLowerCase();

	return friends.filter((friend) => {
		if (selectedTag && !friend.tags.includes(selectedTag)) return false;
		if (!normalizedQuery) return true;

		let searchableHost = friend.siteurl;
		try {
			searchableHost = new URL(friend.siteurl).hostname;
		} catch {
			/* Keep the original URL when it cannot be parsed. */
		}

		return [friend.title, friend.desc, searchableHost, ...friend.tags].some(
			(value) => value.toLowerCase().includes(normalizedQuery),
		);
	});
});

const visibleCount = $derived(filtered.length);

let copiedKey = $state("");
let copyTimer: ReturnType<typeof setTimeout> | undefined;

const siteFields = $derived([
	{ key: "name", label: i18n(I18nKey.friendsSiteName), value: siteName },
	{ key: "desc", label: i18n(I18nKey.friendsSiteDesc), value: siteDescription },
	{ key: "url", label: i18n(I18nKey.friendsSiteUrl), value: siteUrl },
	{
		key: "avatar",
		label: i18n(I18nKey.friendsAvatarUrl),
		value: avatarAbsoluteUrl || avatarUrl,
	},
]);

function templateLine(label: string, value: string) {
	return i18n(I18nKey.friendsApplyTemplateLine)
		.replace("{label}", label)
		.replace("{value}", value);
}

const templateLines = $derived([
	templateLine(
		i18n(I18nKey.friendsSiteName),
		i18n(I18nKey.friendsApplyPlaceholderName),
	),
	templateLine(
		i18n(I18nKey.friendsSiteDesc),
		i18n(I18nKey.friendsApplyPlaceholderDesc),
	),
	templateLine(
		i18n(I18nKey.friendsSiteUrl),
		i18n(I18nKey.friendsApplyPlaceholderUrl),
	),
	templateLine(
		i18n(I18nKey.friendsAvatarUrl),
		i18n(I18nKey.friendsApplyPlaceholderAvatar),
	),
]);

const templateText = $derived(templateLines.join("\n"));

/** 注意事项：申请规则速览（与参考站排版一致，条目化） */
const notes = $derived([
	{
		title: i18n(I18nKey.friendsNoteMutualTitle),
		desc: i18n(I18nKey.friendsNoteMutualDesc),
	},
	{
		title: i18n(I18nKey.friendsNoteMaintainTitle),
		desc: i18n(I18nKey.friendsNoteMaintainDesc),
	},
	{
		title: i18n(I18nKey.friendsNoteContentTitle),
		desc: i18n(I18nKey.friendsNoteContentDesc),
	},
	{
		title: i18n(I18nKey.friendsNoteSiteTitle),
		desc: i18n(I18nKey.friendsNoteSiteDesc),
	},
]);

async function copyText(key: string, value: string) {
	if (!value) return;
	try {
		await navigator.clipboard.writeText(value);
		copiedKey = key;
		showSnackbar(i18n(I18nKey.copySuccess));
		if (copyTimer) clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copiedKey = ""), 1600);
	} catch {
		showSnackbar(i18n(I18nKey.copyFailed));
	}
}

onDestroy(() => {
	if (copyTimer) clearTimeout(copyTimer);
});

function countLabel(count: number) {
	return `${count} ${i18n(count === 1 ? I18nKey.friendsCount : I18nKey.friendsCounts)}`;
}

/** 标签筛选：指示器展示 → 淡出 → 列表重新揭幕（与动态页同语言） */
function onTagChange() {
	phaseTimers.forEach(clearTimeout);
	phase = "loading";
	phaseTimers = [
		setTimeout(() => (phase = "out"), 300),
		setTimeout(() => (phase = "idle"), 300 + 150),
	];
}

// 筛选状态同步到 URL（?q= / ?tag=），刷新/分享/回退保留
$effect(() => {
	// 先读依赖（无论是否初始化都注册），避免首次 return 后不再追踪
	const q = query;
	const t = selectedTag;
	if (!initialized) return;
	const params = new URLSearchParams(window.location.search);
	params.delete("q");
	params.delete("tag");
	if (q) params.set("q", q);
	if (t) params.set("tag", t);
	const qs = params.toString();
	history.replaceState(
		history.state,
		"",
		qs ? `?${qs}` : window.location.pathname,
	);
});

onMount(() => {
	const params = new URLSearchParams(window.location.search);
	query = params.get("q") || "";
	selectedTag = params.get("tag") || "";
	initialized = true;
	return () => phaseTimers.forEach(clearTimeout);
});
</script>

<Card color="var(--card-bg)" radius="l" class="friend-section px-8 py-6">
	<PageHeader
		icon="material-symbols:handshake-outline-rounded"
		{title}
		{subtitle}
	/>

	{#if friends.length > 0}
		<div class="friend-section__tools">
			<div class="friend-section__search">
				<TextField
					type="search"
					bind:value={query}
					placeholder={i18n(I18nKey.search)}
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
						class="friend-section__search-clear"
						aria-label={i18n(I18nKey.clear)}
						onclick={() => (query = "")}
					>
						<Icon icon="material-symbols:close-rounded" aria-hidden="true" />
					</button>
				{/if}
			</div>

			{#if tagItems.length > 0}
				<div class="friend-section__chips">
					<Chips
						items={tagItems}
						variant="filter"
						bind:value={selectedTag}
						onchange={onTagChange}
					/>
				</div>
			{/if}
			<p class="friend-section__count">{countLabel(visibleCount)}</p>
		</div>
	{/if}

	{#if phase !== "idle"}
		<!-- 标签筛选过渡：contained 指示器展示后淡出，再由列表揭幕（与动态页同语言） -->
		<div
			class="friend-section__loading"
			class:friend-section__loading--out={phase === "out"}
		>
			<LoadingIndicator contained size={64} />
		</div>
	{:else if filtered.length > 0}
		{#key `${query}|${selectedTag}`}
			<div class="friend-section__list">
				{#each filtered as friend (friend.id)}
					<FriendCard {friend} />
				{/each}
			</div>
		{/key}
	{:else}
		<div class="friend-section__empty">
			<Icon icon="material-symbols:search-off-outline-rounded" aria-hidden="true" />
			<span>{i18n(I18nKey.friendsNoResults)}</span>
		</div>
	{/if}
</Card>

<!-- 友链指南：并排两张卡片（本站信息 / 申请友链）+ 通栏注意事项 -->
<div class="friend-apply">
	<Card radius="l" class="friend-apply__card p-4 md:p-6">
		<div class="friend-apply__site">
			<div class="friend-apply__identity">
				<Avatar src={avatarUrl} alt={siteName} size={56} shape="rounded" />
				<div class="friend-apply__identity-text">
					<p class="friend-apply__name">{siteName}</p>
					{#if siteDescription}
						<p class="friend-apply__bio">{siteDescription}</p>
					{/if}
				</div>
			</div>

			<ul class="friend-apply__fields">
				{#each siteFields as field (field.key)}
					<li class="friend-apply__field">
						<span class="friend-apply__field-text">
							<span class="friend-apply__field-label">{field.label}</span>
							<span class="friend-apply__field-value" title={field.value}>
								{field.value}
							</span>
						</span>
						<span class="friend-apply__copy">
							<IconButton
								size="xsmall"
								shape="square"
								label={`${i18n(I18nKey.copy)} ${field.label}`}
								class="text-[1rem]"
								onclick={() => copyText(field.key, field.value)}
							>
								<Icon
									icon={copiedKey === field.key
										? "material-symbols:check-rounded"
										: "material-symbols:content-copy-outline-rounded"}
									aria-hidden="true"
								/>
							</IconButton>
						</span>
					</li>
				{/each}
			</ul>
		</div>
	</Card>

	<Card radius="l" class="friend-apply__card p-4 md:p-6">
		<div class="friend-apply__panel">
			<h2 class="friend-apply__title">
				<span class="friend-apply__title-icon">
					<Icon
						icon="material-symbols:assignment-outline-rounded"
						aria-hidden="true"
					/>
				</span>
				{i18n(I18nKey.friendsApplyTitle)}
			</h2>

			<ol class="friend-apply__steps">
				<li class="friend-apply__step">
					<span class="friend-apply__step-index" aria-hidden="true">1</span>
					<div class="friend-apply__step-body">
						<h3 class="friend-apply__step-title">
							{i18n(I18nKey.friendsApplyStep1)}
						</h3>
						<p class="friend-apply__step-desc">
							{i18n(I18nKey.friendsApplyStep1Desc)}
						</p>
					</div>
				</li>
				<li class="friend-apply__step">
					<span class="friend-apply__step-index" aria-hidden="true">2</span>
					<div class="friend-apply__step-body">
						<h3 class="friend-apply__step-title">
							{i18n(I18nKey.friendsApplyStep2)}
						</h3>
						<p class="friend-apply__step-desc">
							{i18n(I18nKey.friendsApplyStep2Desc)}
						</p>

						<div class="friend-apply__template">
							<div class="friend-apply__template-lines">
								{#each templateLines as line}
									<span class="friend-apply__template-line">{line}</span>
								{/each}
							</div>
							<span class="friend-apply__template-copy">
								<IconButton
									size="xsmall"
									shape="square"
									label={`${i18n(I18nKey.copy)} ${i18n(I18nKey.friendsApplyTemplate)}`}
									class="text-[1rem]"
									onclick={() => copyText("template", templateText)}
								>
									<Icon
										icon={copiedKey === "template"
											? "material-symbols:check-rounded"
											: "material-symbols:content-copy-outline-rounded"}
										aria-hidden="true"
									/>
								</IconButton>
							</span>
						</div>

						{#if contacts.length > 0}
							<div class="friend-apply__contacts">
								<span class="friend-apply__contacts-label">
									{i18n(I18nKey.friendsContact)}
								</span>
								<div class="friend-apply__contact-list">
									{#each contacts as contact (contact.href)}
										<a
											class="friend-apply__contact m3-state-layer"
											href={contact.href}
											target={contact.href.startsWith("http") ? "_blank" : undefined}
											rel={contact.href.startsWith("http")
												? "noreferrer noopener"
												: undefined}
										>
											<span class="friend-apply__contact-icon">
												<Icon icon={contact.icon} aria-hidden="true" />
											</span>
											<span class="friend-apply__contact-text">
												<span class="friend-apply__contact-label">
													{contact.label}
												</span>
												<span class="friend-apply__contact-value">
													{contact.value}
												</span>
											</span>
										</a>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</li>
				<li class="friend-apply__step">
					<span class="friend-apply__step-index" aria-hidden="true">3</span>
					<div class="friend-apply__step-body">
						<h3 class="friend-apply__step-title">
							{i18n(I18nKey.friendsApplyStep3)}
						</h3>
						<p class="friend-apply__step-desc">
							{i18n(I18nKey.friendsApplyStep3Desc)}
						</p>
					</div>
				</li>
			</ol>
		</div>
	</Card>

	<Card radius="l" class="friend-apply__card p-4 md:p-6 md:col-span-2">
		<h3 class="friend-apply__notes-title">
			<Icon icon="material-symbols:info-outline-rounded" aria-hidden="true" />
			{i18n(I18nKey.friendsNotes)}
		</h3>
		<ul class="friend-apply__notes">
			{#each notes as note (note.title)}
				<li class="friend-apply__note">
					<strong>{note.title}</strong>
					<span>{note.desc}</span>
				</li>
			{/each}
		</ul>
	</Card>
</div>

<style lang="stylus">
@import "../../styles/breakpoints.styl"

.friend-section
	display: block

	&__tools
		display: flex
		flex-direction: column
		gap: 0.875rem
		padding-bottom: 1.5rem
		border-bottom: 1px solid var(--outline-variant)

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

	&__chips
		width: 100%

	&__count
		margin: 0
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)

	/* 标签筛选过渡：区块位置的大号 contained LoadingIndicator（out = 淡出退场，与动态页同语言） */
	&__loading
		display: flex
		align-items: center
		justify-content: center
		min-height: 11rem
		padding-top: 1.5rem

		&--out
			animation: friend-loading-out var(--m3e-duration-short) var(--m3e-easing-emphasized-accelerate) both

	&__list
		display: grid
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr))
		gap: 0.875rem
		padding-top: 1.5rem
		animation: friend-fade-in var(--m3e-duration-medium) var(--m3e-easing-standard)

	&__empty
		display: flex
		flex-direction: column
		align-items: center
		justify-content: center
		gap: 0.75rem
		min-height: 11rem
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-large)
		> :global(svg)
			width: 2.5rem
			height: 2.5rem

	@media (max-width: bp-sm - 1px)
		padding: 1rem 0.75rem

		&__list
			padding-top: 1.25rem

/* 友链指南：并排两张卡片（本站信息 / 申请友链），下方通栏注意事项 */
.friend-apply
	display: grid
	grid-template-columns: minmax(0, 1fr)
	gap: 1rem
	margin-top: 1rem

	@media (min-width: bp-md)
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)
		gap: 1.25rem

	&__site
		display: flex
		flex-direction: column
		gap: 1rem

	&__notes-title
		display: flex
		align-items: center
		gap: 0.5rem
		margin: 0 0 1rem
		color: var(--on-surface)
		font: var(--m3e-type-title-small)
		font-weight: 700

		> :global(svg)
			flex-shrink: 0
			width: 1.125rem
			height: 1.125rem
			color: var(--on-surface-variant)

	&__notes
		margin: 0
		padding: 0 0 0 1.25rem
		list-style: disc
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)
		line-height: 1.6

		> li + li
			margin-top: 0.75rem

	&__note
		strong
			margin-right: 0.375rem
			color: var(--on-surface)
			font-weight: 700

	&__identity
		display: flex
		align-items: center
		gap: 0.75rem

	&__identity-text
		min-width: 0

	&__name
		margin: 0
		color: var(--on-surface)
		font: var(--m3e-type-title-small)
		font-weight: 700
		line-height: 1.3

	&__bio
		margin: 0.125rem 0 0
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)
		line-height: 1.5

	&__fields
		display: flex
		flex-direction: column
		gap: 0.5rem
		margin: 0
		padding: 0
		list-style: none

	&__field
		display: flex
		align-items: center
		gap: 0.5rem
		padding: 0.5rem 0.5rem 0.5rem 0.75rem
		border-radius: var(--shape-corner-m)
		background: var(--surface-container-high)

	&__field-text
		display: flex
		flex: 1
		flex-direction: column
		gap: 0.125rem
		min-width: 0

	&__field-label
		color: var(--on-surface-variant)
		font: var(--m3e-type-label-small)
		line-height: 1.3

	&__field-value
		overflow: hidden
		color: var(--on-surface)
		font: var(--m3e-type-body-small)
		line-height: 1.4
		text-overflow: ellipsis
		white-space: nowrap

	&__copy
		display: inline-flex
		flex-shrink: 0

	&__panel
		min-width: 0

	&__title
		display: flex
		align-items: center
		gap: 0.5rem
		margin: 0 0 1rem
		color: var(--on-surface)
		font: var(--m3e-type-title-small)
		font-weight: 700

	&__title-icon
		display: inline-flex
		flex-shrink: 0
		align-items: center
		justify-content: center
		width: 1.75rem
		height: 1.75rem
		border-radius: var(--shape-corner-s)
		background: var(--surface-container-high)
		color: var(--on-surface-variant)
		> :global(svg)
			width: 1.125rem
			height: 1.125rem

	&__steps
		margin: 0
		padding: 0
		list-style: none

	&__step
		position: relative
		display: grid
		grid-template-columns: 1.5rem minmax(0, 1fr)
		gap: 0.75rem
		padding-bottom: 1.25rem

		&:last-child
			padding-bottom: 0

		&:not(:last-child)::before
			content: ""
			position: absolute
			top: 1.75rem
			bottom: 0.25rem
			left: 0.6875rem
			width: 1px
			background: var(--outline-variant)

	&__step-index
		display: inline-flex
		align-items: center
		justify-content: center
		width: 1.5rem
		height: 1.5rem
		border-radius: var(--shape-corner-full)
		background: var(--on-surface)
		color: var(--surface)
		font: var(--m3e-type-label-medium)
		font-weight: 700

	&__step-body
		min-width: 0

	&__step-title
		margin: 0
		color: var(--on-surface)
		font: var(--m3e-type-title-small)
		font-weight: 600
		line-height: 1.4

	&__step-desc
		margin: 0.25rem 0 0
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)
		line-height: 1.6

	&__template
		position: relative
		margin-top: 0.75rem
		padding: 0.75rem 2.75rem 0.75rem 1rem
		border-radius: var(--shape-corner-m)
		background: var(--surface-container-high)
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)
		line-height: 1.8

	&__template-copy
		position: absolute
		top: 0.5rem
		right: 0.5rem
		display: inline-flex

	&__template-lines
		display: flex
		flex-direction: column
		gap: 0.125rem

	&__template-line
		display: block

	&__contacts
		margin-top: 1rem

	&__contacts-label
		display: block
		margin-bottom: 0.5rem
		color: var(--on-surface-variant)
		font: var(--m3e-type-label-small)

	&__contact-list
		display: flex
		flex-wrap: wrap
		gap: 0.5rem

	&__contact
		display: inline-flex
		align-items: center
		gap: 0.5rem
		padding: 0.375rem 0.75rem
		border: 1px solid var(--outline-variant)
		border-radius: var(--shape-corner-m)
		color: var(--on-surface)
		text-decoration: none

		&:hover
			border-color: var(--outline)

	&__contact-icon
		display: inline-flex
		flex-shrink: 0
		color: var(--on-surface-variant)
		> :global(svg)
			width: 1.125rem
			height: 1.125rem

	&__contact-text
		display: flex
		flex-direction: column
		min-width: 0

	&__contact-label
		color: var(--on-surface-variant)
		font: var(--m3e-type-label-small)
		line-height: 1.2

	&__contact-value
		color: var(--on-surface)
		font: var(--m3e-type-body-small)
		line-height: 1.3

/* 筛选结果淡入（reduced-motion 由全局 motion-reduced 规则禁用动画） */
@keyframes friend-fade-in
	from
		opacity: 0
		transform: translateY(0.25rem)
	to
		opacity: 1
		transform: translateY(0)

/* 指示器退场：淡出 + 轻微收拢（reduced-motion 由全局规则压至终态） */
@keyframes friend-loading-out
	from
		opacity: 1
		transform: none
	to
		opacity: 0
		transform: scale(0.96)
</style>
