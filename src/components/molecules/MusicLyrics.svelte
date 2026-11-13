<script lang="ts">
import { findActiveLyricIndex, type LyricLine } from "@utils/music/lyrics";

interface Props {
	lines: readonly LyricLine[];
	loading: boolean;
	currentTime: number;
	label: string;
	loadingLabel: string;
	emptyLabel: string;
}

let { lines, loading, currentTime, label, loadingLabel, emptyLabel }: Props =
	$props();

let scroller = $state<HTMLElement | null>(null);
let autoScrollPausedUntil = 0;

const activeIndex = $derived(findActiveLyricIndex(lines, currentTime));

/** 手动滚动后暂时让出控制权，避免自动居中与用户滚动打架。 */
function pauseAutoScroll() {
	autoScrollPausedUntil = Date.now() + 4000;
}

$effect(() => {
	const index = activeIndex;
	const element = scroller;
	if (index < 0 || !element) return;
	if (Date.now() < autoScrollPausedUntil) return;

	const target = element.querySelector<HTMLElement>(
		`[data-lyric-index="${index}"]`,
	);
	if (!target) return;
	const offset =
		target.offsetTop - element.clientHeight / 2 + target.clientHeight / 2;
	element.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
});
</script>

<div class="music-lyrics">
	{#if loading}
		<p class="music-lyrics__status">{loadingLabel}</p>
	{:else if lines.length === 0}
		<p class="music-lyrics__status">{emptyLabel}</p>
	{:else}
		<div
			bind:this={scroller}
			class="music-lyrics__scroller"
			tabindex="0"
			role="group"
			aria-label={label}
			onwheel={pauseAutoScroll}
			ontouchmove={pauseAutoScroll}
			onpointerdown={pauseAutoScroll}
		>
			{#each lines as line, index (index)}
				<p
					class="music-lyrics__line"
					class:music-lyrics__line--active={index === activeIndex}
					data-lyric-index={index}
					data-active={index === activeIndex ? "true" : undefined}
				>
					{line.text}
				</p>
			{/each}
		</div>
	{/if}
</div>

<style lang="stylus">
.music-lyrics
	display: flex
	flex-direction: column
	min-height: 0

	&__status
		margin: 0
		padding: 0.75rem 0.5rem
		color: var(--on-surface-variant)
		font: var(--m3e-type-label-medium)
		text-align: center

	&__scroller
		position: relative
		max-height: 10rem
		overflow-y: auto
		overscroll-behavior: contain
		padding: 0.5rem 0.625rem
		scrollbar-width: thin
		scrollbar-color: var(--scrollbar-bg) transparent

		&::-webkit-scrollbar
			width: 0.375rem

		&::-webkit-scrollbar-track
			background: transparent

		&::-webkit-scrollbar-thumb
			border-radius: var(--shape-corner-full)
			background: var(--scrollbar-bg)

		&:focus-visible
			outline: 2px solid var(--primary)
			outline-offset: -2px
			border-radius: var(--shape-corner-m)

	&__line
		margin: 0
		padding: 0.1875rem 0
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)
		line-height: 1.45
		text-align: center
		opacity: 0.72
		transition:
			color 200ms var(--m3e-easing-standard),
			opacity 200ms var(--m3e-easing-standard),
			transform 200ms var(--m3e-easing-standard)

		&--active
			color: var(--primary)
			font: var(--m3e-type-label-large)
			opacity: 1
			transform: scale(1.03)

@media (prefers-reduced-motion: reduce)
	.music-lyrics__line
		transition: none

	.music-lyrics__line--active
		transform: none
</style>
