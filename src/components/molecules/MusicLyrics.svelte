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

/** 与底部胶囊歌词条一致：只显示当前句与下一句，避免整段歌词撑高侧栏卡片。 */
const activeIndex = $derived(findActiveLyricIndex(lines, currentTime));
const currentLyric = $derived(
	activeIndex >= 0 ? (lines[activeIndex]?.text ?? null) : null,
);
const nextLyric = $derived(lines[activeIndex + 1]?.text ?? null);
</script>

<div class="music-lyrics" role="group" aria-label={label}>
	{#if loading}
		<p class="music-lyrics__line">{loadingLabel}</p>
	{:else if currentLyric || nextLyric}
		{#if currentLyric}
			<p class="music-lyrics__line is-active">{currentLyric}</p>
		{/if}
		{#if nextLyric}
			<p class="music-lyrics__line">{nextLyric}</p>
		{/if}
	{:else}
		<p class="music-lyrics__line">{emptyLabel}</p>
	{/if}
</div>

<style lang="stylus">
.music-lyrics
	display: flex
	flex-direction: column
	align-items: center
	gap: 0.125rem
	padding: 0.5rem 0.625rem
	text-align: center

	&__line
		margin: 0
		color: var(--on-surface-variant)
		font: var(--m3e-type-label-large)
		line-height: 1.4
		text-wrap: balance

		&.is-active
			color: var(--primary)
			font: var(--m3e-type-title-small)
</style>
