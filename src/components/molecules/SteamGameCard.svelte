<script lang="ts">
/**
 * Steam 游戏卡片（分子）：横屏头图 + 时长 / 最近两周 / 成就完成度。
 *
 * 数据全部来自构建期快照，不发起任何请求。没有封面时退化为渐变横幅 +
 * Steam 图标，与 GameCard 的无封面回退语言一致。
 */
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { GAME_STATUS_META } from "@utils/games/status";
import type { SteamGameEntry } from "@/types/gamesConfig";

let {
	game,
	showRecent = false,
}: { game: SteamGameEntry; showRecent?: boolean } = $props();

/** 不足 1 小时按分钟显示，避免出现「0 小时」 */
function formatPlaytime(minutes: number) {
	if (minutes < 60) {
		return { value: minutes, unit: i18n(I18nKey.gamesMinutes) };
	}
	return { value: Math.round(minutes / 60), unit: i18n(I18nKey.gamesHours) };
}

const playtime = $derived(formatPlaytime(game.minutes));
const storeUrl = $derived(`https://store.steampowered.com/app/${game.appId}/`);
const recent = $derived(
	showRecent && game.recentMinutes ? formatPlaytime(game.recentMinutes) : null,
);
const achievements = $derived(game.achievements);
const percent = $derived(
	achievements
		? Math.round((achievements.done / achievements.total) * 100)
		: 0,
);
const achievementLabel = $derived(
	achievements
		? `${i18n(I18nKey.gamesCredentialAchievements)} ${achievements.done}/${achievements.total}`
		: "",
);
const statusMeta = $derived(
	game.status ? GAME_STATUS_META[game.status] : null,
);
</script>

<article
	class={`steam-game-card ${game.cover ? "" : "steam-game-card--no-cover"}`}
	data-steam-appid={game.appId}
>
	<div class="steam-game-card__media">
		<a
			class="steam-game-card__media-link"
			href={storeUrl}
			target="_blank"
			rel="noopener noreferrer"
			tabindex="-1"
			aria-hidden="true"
		>
			{#if game.cover}
				<img
					class="steam-game-card__cover"
					src={game.cover}
					alt=""
					loading="lazy"
					decoding="async"
				/>
			{:else}
				<span class="steam-game-card__fallback">
					<Icon icon="simple-icons:steam" />
				</span>
			{/if}
		</a>

		<span class="steam-game-card__scrim" aria-hidden="true"></span>

		{#if statusMeta}
			<span
				class="steam-game-card__status"
				data-status={game.status}
				style={`--game-status-bg: ${statusMeta.bg}; --game-status-fg: ${statusMeta.fg};`}
				aria-label={i18n(statusMeta.key)}
			>
				<Icon icon={statusMeta.icon} aria-hidden="true" />
				{i18n(statusMeta.key)}
			</span>
		{/if}

		<div class="steam-game-card__caption">
			<h3 class="steam-game-card__title">{game.name}</h3>
		</div>
	</div>

	<div class="steam-game-card__body">
		<div class="steam-game-card__meta">
			<span class="steam-game-card__hours">
				<Icon icon="material-symbols:timer-outline-rounded" aria-hidden="true" />
				{playtime.value}
				{playtime.unit}
				{#if game.local}
					<span class="steam-game-card__local">
						{i18n(I18nKey.steamLocalPlaytime)}
					</span>
				{/if}
			</span>
			{#if recent}
				<span class="steam-game-card__recent">
					<Icon icon="material-symbols:bolt-outline-rounded" aria-hidden="true" />
					{i18n(I18nKey.steamRecent)}
					{recent.value}
					{recent.unit}
				</span>
			{/if}
		</div>

		{#if achievements}
			<div
				class="steam-game-card__achievement"
				role="progressbar"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={percent}
				aria-label={achievementLabel}
			>
				<div class="steam-game-card__achievement-head">
					<span class="steam-game-card__achievement-label">
						<Icon icon="material-symbols:star-rounded" aria-hidden="true" />
						{i18n(I18nKey.gamesCredentialAchievements)}
					</span>
					<span class="steam-game-card__achievement-value">
						{achievements.done}/{achievements.total}
					</span>
				</div>
				<span class="steam-game-card__bar" aria-hidden="true">
					<span
						class="steam-game-card__bar-fill"
						style={`width: ${percent}%`}
					></span>
				</span>
			</div>
		{/if}

		{#if game.tags && game.tags.length > 0}
			<div class="steam-game-card__tags">
				{#each game.tags as tag (tag)}
					<span class="steam-game-card__tag">{tag}</span>
				{/each}
			</div>
		{/if}

		<div class="steam-game-card__footer">
			<a
				class="steam-game-card__link"
				href={storeUrl}
				target="_blank"
				rel="noopener noreferrer"
				aria-label={`${game.name} · ${i18n(I18nKey.gamesViewDetails)}`}
			>
				<Icon icon="simple-icons:steam" aria-hidden="true" />
				{i18n(I18nKey.gamesViewDetails)}
			</a>
		</div>
	</div>
</article>

<style lang="stylus">
.steam-game-card
	display: flex
	flex-direction: column
	overflow: hidden
	background: var(--card-bg)
	border: 1px solid var(--outline-variant)
	border-radius: var(--shape-corner-l)
	transition:
		border-color var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
		box-shadow var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate),
		transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate)

	&:hover
		border-color: var(--outline)
		box-shadow: var(--m3e-elevation-2)
		transform: translateY(-2px)

	&__media
		position: relative
		display: flex
		align-items: center
		justify-content: center
		width: 100%
		aspect-ratio: 16 / 9
		flex-shrink: 0
		overflow: hidden
		background: linear-gradient(150deg,
			unquote("color-mix(in oklab, var(--primary) 12%, var(--surface-container-low))"),
			var(--surface-container-high))

	/* 整块头图 = 商店入口（键盘焦点仍由底栏按钮承担，避免重复停留） */
	&__media-link
		position: absolute
		inset: 0
		display: flex
		align-items: center
		justify-content: center
		cursor: pointer

	&__cover
		position: absolute
		inset: 0
		display: block
		width: 100%
		height: 100%
		object-fit: cover
		transition: transform var(--m3e-duration-long) var(--m3e-easing-emphasized-decelerate)

		.steam-game-card:hover &
			transform: scale(1.04)

	&__fallback
		display: flex
		align-items: center
		justify-content: center
		width: 3.5rem
		height: 3.5rem
		border-radius: var(--shape-corner-l)
		background: unquote("color-mix(in oklab, var(--primary) 10%, var(--surface-container-highest))")
		border: 1px solid var(--outline-variant)
		color: var(--primary)

		> :global(svg)
			width: 2rem
			height: 2rem

	&__body
		display: flex
		flex-direction: column
		flex: 1
		gap: var(--m3e-space-3)
		min-width: 0
		padding: var(--m3e-space-4)

	/* 封面包底压印渐变（图像叠层可读性例外：允许固定黑色） */
	&__scrim
		position: absolute
		inset: 0
		z-index: 1
		pointer-events: none
		background: linear-gradient(to top,
			rgba(0, 0, 0, 0.78) 0%,
			rgba(0, 0, 0, 0.42) 38%,
			rgba(0, 0, 0, 0) 72%)

	&--no-cover &__scrim
		background: linear-gradient(to top,
			unquote("color-mix(in oklab, var(--surface-container-high) 92%, transparent)") 0%,
			unquote("color-mix(in oklab, var(--surface-container-high) 40%, transparent)") 45%,
			transparent 75%)

	/* 状态 pill：贴封面右上角，复用 GameCard 的 tonal 语言 */
	&__status
		position: absolute
		top: 0.625rem
		right: 0.625rem
		z-index: 3
		display: inline-flex
		align-items: center
		gap: 0.3125rem
		padding: 0.125rem 0.5625rem
		border-radius: var(--shape-corner-full)
		background: var(--game-status-bg)
		color: var(--game-status-fg)
		font: var(--m3e-type-label-small)
		font-weight: 600
		border: 1px solid unquote("color-mix(in oklab, var(--game-status-fg) 24%, transparent)")
		box-shadow: var(--m3e-elevation-1)

		> :global(svg)
			width: 0.875rem
			height: 0.875rem
			flex-shrink: 0

	/* 标题压印在头图包底，与 GameCard 的 caption 对齐 */
	&__caption
		position: absolute
		bottom: 0
		left: 0
		right: 0
		z-index: 2
		display: flex
		flex-direction: column
		gap: 0.125rem
		padding: 0.75rem var(--m3e-space-4)
		pointer-events: none

	&__title
		margin: 0
		min-width: 0
		color: #fff
		font: var(--m3e-type-title-medium)
		font-weight: 700
		line-height: 1.3
		overflow-wrap: anywhere
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5)

	&--no-cover &__title
		color: var(--on-surface)
		text-shadow: none

	/* 主要类型标签（2–3 个），沿用 miHoYo 卡片的 chips 语言 */
	&__tags
		display: flex
		flex-wrap: wrap
		gap: 0.375rem
		min-width: 0

	&__tag
		padding: 0.0625rem 0.5rem
		border-radius: var(--shape-corner-full)
		background: unquote("color-mix(in oklab, var(--primary) 8%, var(--surface-container-high))")
		color: var(--primary)
		font: var(--m3e-type-label-small)
		font-weight: 500

	&__meta
		display: flex
		flex-wrap: wrap
		align-items: center
		gap: 0.375rem

	&__hours
		display: inline-flex
		align-items: center
		gap: 0.25rem
		padding: 0.125rem 0.5rem
		border-radius: var(--shape-corner-full)
		background: var(--surface-container-high)
		color: var(--on-surface-variant)
		font: var(--m3e-type-label-small)
		font-variant-numeric: tabular-nums

		> :global(svg)
			width: 0.875rem
			height: 0.875rem
			flex-shrink: 0

	&__local
		opacity: 0.7
		white-space: nowrap

	&__recent
		display: inline-flex
		align-items: center
		gap: 0.25rem
		padding: 0.125rem 0.5rem
		border-radius: var(--shape-corner-full)
		background: unquote("color-mix(in oklab, var(--tertiary) 10%, var(--surface-container-high))")
		color: var(--on-surface-variant)
		font: var(--m3e-type-label-small)
		font-variant-numeric: tabular-nums

		> :global(svg)
			width: 0.875rem
			height: 0.875rem
			flex-shrink: 0
			color: var(--tertiary)

	&__achievement
		display: flex
		flex-direction: column
		gap: 0.25rem
		padding-top: 0.25rem

	&__achievement-head
		display: flex
		align-items: center
		justify-content: space-between
		gap: 0.5rem
		color: var(--on-surface-variant)
		font: var(--m3e-type-label-small)

	&__achievement-label
		display: inline-flex
		align-items: center
		gap: 0.25rem

		> :global(svg)
			width: 0.875rem
			height: 0.875rem
			color: var(--tertiary)

	&__achievement-value
		color: var(--on-surface)
		font-weight: 700
		font-variant-numeric: tabular-nums

	&__bar
		display: block
		width: 100%
		height: 0.25rem
		overflow: hidden
		border-radius: var(--shape-corner-full)
		background: var(--surface-container-highest)

	&__bar-fill
		display: block
		height: 100%
		border-radius: inherit
		background: var(--tertiary)

	/* 商店入口：底栏右对齐，视觉语言与 GameCard 的外链按钮一致 */
	&__footer
		display: flex
		flex-wrap: wrap
		align-items: center
		justify-content: flex-end
		gap: 0.5rem
		margin-top: auto
		padding-top: 0.25rem

	&__link
		display: inline-flex
		align-items: center
		gap: 0.3125rem
		padding: 0.3125rem 0.75rem
		min-height: 2.25rem
		border-radius: var(--shape-corner-m)
		background: unquote("color-mix(in oklab, var(--primary) 8%, transparent)")
		color: var(--primary)
		font: var(--m3e-type-label-medium)
		font-weight: 600
		text-decoration: none
		border: 1px solid unquote("color-mix(in oklab, var(--primary) 16%, transparent)")
		transition:
			background-color var(--m3e-duration-short) var(--m3e-easing-standard),
			box-shadow var(--m3e-duration-short) var(--m3e-easing-standard),
			transform var(--m3e-duration-short) var(--m3e-easing-standard)

		&:hover
			background: unquote("color-mix(in oklab, var(--primary) 16%, transparent)")
			box-shadow: var(--m3e-elevation-1)
			transform: translateY(-1px)

		&:focus-visible
			outline: 2px solid var(--primary)
			outline-offset: 2px

		> :global(svg)
			width: 1rem
			height: 1rem
</style>
