<script lang="ts">
import IconButton from "@components/atoms/action/IconButton.svelte";
import Icon from "@iconify/svelte";
import {
	findActiveLyricIndex,
	type LyricLine,
	loadTrackLyrics,
} from "@utils/music/lyrics";
import { onMount, tick } from "svelte";
import type { ResolvedMusicOptions } from "@/config/musicConfig";
import type {
	MusicPlayerLabels,
	MusicRuntime,
	MusicSnapshot,
	PlaybackMode,
} from "@/types/musicConfig";

interface Props {
	options: ResolvedMusicOptions;
	labels: MusicPlayerLabels;
}

let { options, labels }: Props = $props();

let runtime = $state<MusicRuntime | null>(null);
const hasInitialTracks = options.playlist.length > 0;
const hasMeting =
	(options.provider === "meting" || options.provider === "mixed") &&
	Boolean(options.meting?.id);

let snapshot = $state<MusicSnapshot>({
	playlist: options.playlist,
	currentIndex: hasInitialTracks ? 0 : -1,
	currentTrack: options.playlist[0] ?? null,
	status: "idle",
	currentTime: 0,
	duration: options.playlist[0]?.duration ?? 0,
	volume: options.defaultVolume,
	muted: false,
	mode: options.defaultMode,
	error: hasInitialTracks || hasMeting ? null : "empty-playlist",
	excludedCount: 0,
});

/** 光碟交互：点击展开/收起面板，按住拖动可移动胶囊。 */
let open = $state(false);
let playlistOpen = $state(false);
let lyricsOpen = $state(false);
/** 歌词条元素：用于测量高度，供布局预留页面底部空间。 */
let lyricsBarEl = $state<HTMLElement | null>(null);
let lyricsLines = $state<readonly LyricLine[]>([]);
let lyricsLoading = $state(false);
let lyricsRequest = 0;

const POSITION_KEY = "shirone-music-capsule-position";

/** 拖拽位移：相对 CSS 锚点（左下/右下角）的像素偏移，本地持久化。 */
let offset = $state({ x: 0, y: 0 });
let capsuleEl = $state<HTMLElement | null>(null);
let dragging = $state(false);
let suppressDiscClick = false;
let dragState: {
	pointerId: number;
	startX: number;
	startY: number;
	originX: number;
	originY: number;
	left: number;
	top: number;
	width: number;
	height: number;
	moved: boolean;
} | null = null;

onMount(() => {
	let unsubscribe = () => {};
	let active = true;
	let resizeObserver: ResizeObserver | null = null;
	offset = readStoredPosition();
	void tick().then(() => {
		if (!active) return;
		ensureCapsuleInViewport();
		if (capsuleEl && typeof ResizeObserver !== "undefined") {
			resizeObserver = new ResizeObserver(() => {
				ensureCapsuleInViewport();
			});
			resizeObserver.observe(capsuleEl);
		}
	});
	const handleResize = () => {
		ensureCapsuleInViewport();
	};
	window.addEventListener("resize", handleResize);
	void import("@utils/music").then(({ getMusicRuntime }) => {
		if (!active) return;
		runtime = getMusicRuntime(options);
		unsubscribe = runtime.subscribe((next) => {
			snapshot = next;
		});
	});
	return () => {
		active = false;
		unsubscribe();
		resizeObserver?.disconnect();
		resizeObserver = null;
		window.removeEventListener("resize", handleResize);
	};
});

const playing = $derived(snapshot.status === "playing");
const loading = $derived(snapshot.status === "loading");
const hasTracks = $derived(snapshot.playlist.length > 0);
const notYetRequested = $derived(
	hasMeting &&
		!hasTracks &&
		snapshot.status === "idle" &&
		snapshot.error === null,
);
const currentTitle = $derived(
	snapshot.currentTrack?.title ??
		(loading
			? labels.loading
			: notYetRequested
				? labels.notRequested
				: labels.empty),
);
const currentArtist = $derived(
	snapshot.currentTrack?.artist ?? (loading ? "..." : "—"),
);
const controlsDisabled = $derived(!hasTracks && !hasMeting);
const expanded = $derived(open);
const progressRatio = $derived(
	snapshot.duration > 0
		? Math.min(Math.max(snapshot.currentTime / snapshot.duration, 0), 1)
		: 0,
);
const volumeLabel = $derived(
	labels.volume.replace("{volume}", String(Math.round(snapshot.volume * 100))),
);

/** 底部歌词条只显示当前句与下一句，避免整段歌词压住页面内容。 */
const activeLyricIndex = $derived(
	findActiveLyricIndex(lyricsLines, snapshot.currentTime),
);
const currentLyric = $derived(
	activeLyricIndex >= 0 ? (lyricsLines[activeLyricIndex]?.text ?? null) : null,
);
const nextLyric = $derived(lyricsLines[activeLyricIndex + 1]?.text ?? null);

const modeOrder: readonly PlaybackMode[] = [
	"sequence",
	"repeat-one",
	"shuffle",
];
const modeIcon = $derived(
	snapshot.mode === "repeat-one"
		? "material-symbols:repeat-one-rounded"
		: snapshot.mode === "shuffle"
			? "material-symbols:shuffle-rounded"
			: "material-symbols:repeat-rounded",
);
const modeLabel = $derived(
	snapshot.mode === "repeat-one"
		? labels.modeRepeatOne
		: snapshot.mode === "shuffle"
			? labels.modeShuffle
			: labels.modeSequence,
);

const liveMessage = $derived.by(() => {
	if (snapshot.error && snapshot.status === "error")
		return labels.errors[snapshot.error];
	if (snapshot.status === "loading") return labels.loading;
	if (snapshot.currentTrack && snapshot.status === "playing") {
		return labels.nowPlaying.replace("{title}", snapshot.currentTrack.title);
	}
	return "";
});

function formatTime(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function cycleMode() {
	const index = modeOrder.indexOf(snapshot.mode);
	runtime?.setMode(modeOrder[(index + 1) % modeOrder.length]);
}

function seekTo(event: Event) {
	const value = Number((event.currentTarget as HTMLInputElement).value);
	if (Number.isFinite(value)) runtime?.seek(value);
}

function setVolume(event: Event) {
	const value = Number((event.currentTarget as HTMLInputElement).value);
	if (Number.isFinite(value)) runtime?.setVolume(value);
}

function readStoredPosition(): { x: number; y: number } {
	try {
		const raw = localStorage.getItem(POSITION_KEY);
		if (!raw) return { x: 0, y: 0 };
		const parsed: unknown = JSON.parse(raw);
		if (parsed && typeof parsed === "object") {
			const { x, y } = parsed as { x?: unknown; y?: unknown };
			if (
				typeof x === "number" &&
				Number.isFinite(x) &&
				typeof y === "number" &&
				Number.isFinite(y)
			) {
				return { x, y };
			}
		}
	} catch {
		// 隐私模式下忽略读取失败，退回默认锚点。
	}
	return { x: 0, y: 0 };
}

function persistPosition() {
	try {
		localStorage.setItem(POSITION_KEY, JSON.stringify(offset));
	} catch {
		// 存储不可用时仅本次页面内可拖动。
	}
}

function bound(value: number, min: number, max: number): number {
	if (max < min) return min;
	return Math.min(Math.max(value, min), max);
}

/** 拖拽时以拖拽开始时的锚点矩形为基准，避免宽度过渡期间反复测量导致抖动。 */
function clampOffset(
	x: number,
	y: number,
	base: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
	const margin = 8;
	return {
		x: bound(
			x,
			margin - base.left,
			window.innerWidth - margin - base.width - base.left,
		),
		y: bound(
			y,
			margin - base.top,
			window.innerHeight - margin - base.height - base.top,
		),
	};
}

function measureCapsule() {
	const el = capsuleEl;
	if (!el) return null;
	const rect = el.getBoundingClientRect();
	if (rect.width === 0 || rect.height === 0) return null;
	return {
		left: rect.left - offset.x,
		top: rect.top - offset.y,
		width: rect.width,
		height: rect.height,
	};
}

/** 视口变化或胶囊显隐后（例如从主页切到内页）把偏移拉回屏幕内。 */
function ensureCapsuleInViewport() {
	const el = capsuleEl;
	if (!el) return;
	const rect = el.getBoundingClientRect();
	if (rect.width === 0 || rect.height === 0) return;
	const margin = 8;
	let dx = 0;
	let dy = 0;
	if (rect.left < margin) dx = margin - rect.left;
	else if (rect.right > window.innerWidth - margin)
		dx = window.innerWidth - margin - rect.right;
	if (rect.top < margin) dy = margin - rect.top;
	else if (rect.bottom > window.innerHeight - margin)
		dy = window.innerHeight - margin - rect.bottom;
	if (dx !== 0 || dy !== 0) offset = { x: offset.x + dx, y: offset.y + dy };
}

function onDiscPointerDown(event: PointerEvent) {
	if (event.pointerType === "mouse" && event.button !== 0) return;
	const base = measureCapsule();
	if (!base) return;
	suppressDiscClick = false;
	dragState = {
		pointerId: event.pointerId,
		startX: event.clientX,
		startY: event.clientY,
		originX: offset.x,
		originY: offset.y,
		...base,
		moved: false,
	};
	dragging = false;
	(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function onDiscPointerMove(event: PointerEvent) {
	const drag = dragState;
	if (!drag || drag.pointerId !== event.pointerId) return;
	const dx = event.clientX - drag.startX;
	const dy = event.clientY - drag.startY;
	if (!drag.moved && Math.hypot(dx, dy) < 5) return;
	drag.moved = true;
	dragging = true;
	offset = clampOffset(drag.originX + dx, drag.originY + dy, drag);
}

function onDiscPointerUp(event: PointerEvent) {
	const drag = dragState;
	if (!drag || drag.pointerId !== event.pointerId) return;
	dragState = null;
	dragging = false;
	const el = event.currentTarget as HTMLElement;
	if (el.hasPointerCapture(event.pointerId))
		el.releasePointerCapture(event.pointerId);
	if (!drag.moved) return;
	// 拖拽结束后的 click 不应再切换固定展开状态。
	suppressDiscClick = true;
	ensureCapsuleInViewport();
	persistPosition();
}

function onDiscClick() {
	if (suppressDiscClick) {
		suppressDiscClick = false;
		return;
	}
	open = !open;
	if (open) {
		primeMetingPlaylist();
	} else {
		// 收起面板只关播放列表；歌词条独立存在，便于收起后继续看歌词。
		playlistOpen = false;
	}
}

/** 按 meting 的 preload 配置预取歌单元数据，避免胶囊长期停在「尚未请求」。 */
function primeMetingPlaylist() {
	if (!hasMeting || options.meting?.preload !== "metadata") return;
	void runtime?.initialize();
}

function togglePlaylist() {
	playlistOpen = !playlistOpen;
	if (playlistOpen) {
		// 播放列表与歌词条互不干扰：展开列表不应收起歌词。
		void runtime?.initialize();
	}
}

function toggleLyrics() {
	lyricsOpen = !lyricsOpen;
	if (lyricsOpen) playlistOpen = false;
}

/** 按需加载当前曲目的歌词；未展开面板时不产生任何请求。 */
async function loadLyricsForCurrentTrack() {
	const track = snapshot.currentTrack;
	const request = ++lyricsRequest;
	lyricsLoading = true;
	lyricsLines = [];
	const lines = track ? await loadTrackLyrics(track, options) : [];
	if (request !== lyricsRequest) return;
	lyricsLines = lines;
	lyricsLoading = false;
}

$effect(() => {
	const trackId = snapshot.currentTrack?.id ?? null;
	if (!lyricsOpen || !trackId) return;
	void loadLyricsForCurrentTrack();
});

/**
 * 歌词条固定在视口底部，会盖住页面末段内容。
 * 把实测高度写入 --music-lyrics-inset，由布局为页面预留等高的底部空间；
 * 胶囊在隐藏页面上不可见时（高度为 0）一并清零。
 */
$effect(() => {
	const bar = lyricsBarEl;
	if (!lyricsOpen || !bar) {
		document.documentElement.style.removeProperty("--music-lyrics-inset");
		return;
	}
	const apply = () => {
		const height = bar.getBoundingClientRect().height;
		if (height > 0) {
			document.documentElement.style.setProperty(
				"--music-lyrics-inset",
				`${Math.ceil(height)}px`,
			);
		} else {
			document.documentElement.style.removeProperty("--music-lyrics-inset");
		}
	};
	apply();
	const observer =
		typeof ResizeObserver === "undefined" ? null : new ResizeObserver(apply);
	observer?.observe(bar);
	return () => {
		observer?.disconnect();
		document.documentElement.style.removeProperty("--music-lyrics-inset");
	};
});
</script>

{#if lyricsOpen}
	<aside
		class="music-capsule__lyrics-bar"
		bind:this={lyricsBarEl}
		role="group"
		aria-label={labels.lyrics}
	>
		<div class="music-capsule__lyrics-inner">
			{#if lyricsLoading}
				<p class="music-capsule__lyrics-line">{labels.lyricsLoading}</p>
			{:else if currentLyric || nextLyric}
				{#if currentLyric}
					<p class="music-capsule__lyrics-line is-active">{currentLyric}</p>
				{/if}
				{#if nextLyric}
					<p class="music-capsule__lyrics-line">{nextLyric}</p>
				{/if}
			{:else}
				<p class="music-capsule__lyrics-line">{labels.lyricsEmpty}</p>
			{/if}
		</div>
	</aside>
{/if}

<div
	class="music-capsule"
	bind:this={capsuleEl}
	data-expanded={expanded}
	data-playlist={playlistOpen}
	data-lyrics={lyricsOpen}
	data-dragging={dragging}
	role="region"
	aria-label={labels.title}
	style={offset.x !== 0 || offset.y !== 0
		? `transform: translate3d(${offset.x}px, ${offset.y}px, 0)`
		: undefined}
	onmouseenter={() => {
		primeMetingPlaylist();
	}}
>
	{#if playlistOpen}
		<div class="music-capsule__playlist" role="group" aria-label={labels.hidePlaylist}>
			{#if snapshot.excludedCount > 0}
				<button
					type="button"
					class="music-capsule__playlist-restore m3-state-layer"
					onclick={() => runtime?.restoreTracks()}
				>
					<Icon icon="material-symbols:restore-from-trash-rounded" aria-hidden="true" />
					{labels.restoreTracks}
				</button>
			{/if}
			{#if snapshot.playlist.length > 0}
				<ol class="music-capsule__playlist-list">
					{#each snapshot.playlist as track, index (track.id)}
						<li class="music-capsule__playlist-row">
							<button
								type="button"
								class="music-capsule__track m3-state-layer"
								aria-current={index === snapshot.currentIndex ? "true" : undefined}
								onclick={() => void runtime?.select(index)}
							>
								<span class="music-capsule__track-cover" aria-hidden="true">
									{#if track.cover}
										<img
											src={track.cover}
											srcset={track.coverSrcset}
											sizes="36px"
											width={track.coverWidth}
											height={track.coverHeight}
											alt=""
											loading="lazy"
											decoding="async"
										/>
									{:else}
										<Icon icon="material-symbols:music-note-rounded" />
									{/if}
								</span>
								<span class="music-capsule__track-copy">
									<strong>{track.title}</strong>
									{#if track.artist}
										<span>{track.artist}</span>
									{/if}
								</span>
							</button>
							<button
								type="button"
								class="music-capsule__track-remove m3-state-layer"
								aria-label={labels.removeTrack}
								title={labels.removeTrack}
								onclick={() => runtime?.removeTrack(track.id)}
							>
								<Icon icon="material-symbols:close-rounded" aria-hidden="true" />
							</button>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="music-capsule__playlist-status">
					{loading ? labels.loading : notYetRequested ? labels.notRequested : labels.empty}
				</p>
			{/if}
		</div>
	{/if}

	<div class="music-capsule__panel" inert={!expanded} aria-hidden={!expanded}>
		<div class="music-capsule__panel-clip">
			<div class="music-capsule__surface">
				<strong class="music-capsule__title" title={currentTitle}>
					{currentTitle}
				</strong>
				<span class="music-capsule__artist" title={currentArtist}>
					{currentArtist}
				</span>

				<div class="music-capsule__progress">
					<span class="music-capsule__time">{formatTime(snapshot.currentTime)}</span>
					<input
						class="music-capsule__progress-input"
						type="range"
						min="0"
						max={snapshot.duration > 0 ? snapshot.duration : 0}
						step="0.1"
						value={snapshot.currentTime}
						style={`--music-progress: ${progressRatio * 100}%`}
						disabled={snapshot.duration <= 0}
						aria-label={labels.progress}
						oninput={seekTo}
					/>
					<span class="music-capsule__time">{formatTime(snapshot.duration)}</span>
				</div>

				<div class="music-capsule__extras">
					<IconButton
						icon="material-symbols:playlist-play-rounded"
						label={playlistOpen ? labels.hidePlaylist : labels.showPlaylist}
						size="xsmall"
						toggle
						checked={playlistOpen}
						onclick={togglePlaylist}
					/>
					<IconButton
						icon="material-symbols:lyrics-rounded"
						label={labels.lyrics}
						size="xsmall"
						toggle
						checked={lyricsOpen}
						onclick={toggleLyrics}
					/>
					<div class="music-capsule__volume">
						<IconButton
							icon={snapshot.muted
								? "material-symbols:volume-off-rounded"
								: "material-symbols:volume-up-rounded"}
							label={snapshot.muted ? labels.unmute : labels.mute}
							size="xsmall"
							onclick={() => runtime?.setMuted(!snapshot.muted)}
						/>
						<input
							class="music-capsule__volume-input"
							type="range"
							min="0"
							max="1"
							step="0.01"
							value={snapshot.volume}
							style={`--music-progress: ${Math.round(snapshot.volume * 100)}%`}
							aria-label={volumeLabel}
							oninput={setVolume}
						/>
					</div>
				</div>

				<div class="music-capsule__dock">
					<IconButton
						icon={modeIcon}
						label={`${labels.playbackMode} · ${modeLabel}`}
						size="xsmall"
						onclick={cycleMode}
					/>
					<IconButton
						icon="material-symbols:skip-previous-rounded"
						label={labels.previous}
						size="small"
						disabled={controlsDisabled}
						onclick={() => void runtime?.previous()}
					/>
					<span class="music-capsule__play">
						<IconButton
							icon="material-symbols:play-arrow-rounded"
							checkedIcon="material-symbols:pause-rounded"
							label={playing ? labels.pause : labels.play}
							variant="filled"
							size="medium"
							toggle
							checked={playing}
							disabled={controlsDisabled}
							onclick={() => void runtime?.toggle()}
						/>
					</span>
					<IconButton
						icon="material-symbols:skip-next-rounded"
						label={labels.next}
						size="small"
						disabled={controlsDisabled}
						onclick={() => void runtime?.next()}
					/>
				</div>
			</div>
		</div>
	</div>

	<button
		type="button"
		class="music-capsule__disc"
		aria-expanded={expanded}
		aria-label={labels.title}
		onpointerdown={onDiscPointerDown}
		onpointermove={onDiscPointerMove}
		onpointerup={onDiscPointerUp}
		onpointercancel={onDiscPointerUp}
		onclick={onDiscClick}
	>
		<span class="music-capsule__disc-spin" class:is-playing={playing}>
			{#if snapshot.currentTrack?.cover}
				<img
					src={snapshot.currentTrack.cover}
					srcset={snapshot.currentTrack.coverSrcset}
					sizes="64px"
					width={snapshot.currentTrack.coverWidth}
					height={snapshot.currentTrack.coverHeight}
					alt=""
					loading="lazy"
					decoding="async"
					draggable="false"
				/>
			{:else}
				<Icon icon="material-symbols:music-note-rounded" aria-hidden="true" />
			{/if}
		</span>
	</button>

	<span class="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</span>
</div>

<style lang="stylus">
.music-capsule
	position: relative
	display: block
	width: 4rem
	min-height: 4rem
	pointer-events: auto
	transition: width 420ms var(--m3e-easing-standard)

	&[data-expanded="true"]
		width: unquote("min(21.5rem, calc(100vw - 1.5rem))")

	&__panel
		display: grid
		grid-template-rows: 0fr
		transition: grid-template-rows 420ms var(--m3e-easing-standard)

	&[data-expanded="true"] &__panel
		grid-template-rows: 1fr

	&__panel-clip
		overflow: hidden
		min-height: 0

	&__surface
		position: relative
		margin-left: 1.75rem
		display: flex
		flex-direction: column
		gap: 0.125rem
		padding: 0.75rem 0.875rem 0.625rem
		border: 1px solid var(--outline-variant)
		border-radius: var(--shape-corner-xl)
		background: unquote("color-mix(in oklab, var(--card-bg) 92%, transparent)")
		-webkit-backdrop-filter: blur(12px)
		backdrop-filter: blur(12px)
		opacity: 0
		transform: translate3d(0, 0.5rem, 0)
		transition:
			opacity 200ms ease,
			transform 280ms var(--m3e-easing-standard)

	&[data-expanded="true"] &__surface
		opacity: 1
		transform: none
		transition-delay: 90ms

	&__title
		overflow: hidden
		color: var(--on-surface)
		font: var(--m3e-type-title-small)
		line-height: 1.3
		text-overflow: ellipsis
		white-space: nowrap

	&__artist
		overflow: hidden
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-small)
		line-height: 1.3
		text-overflow: ellipsis
		white-space: nowrap

	&__progress
		display: flex
		align-items: center
		gap: 0.5rem
		margin-top: 0.25rem
		color: var(--on-surface-variant)
		font: var(--m3e-type-label-small)
		font-variant-numeric: tabular-nums

	&__time
		flex-shrink: 0
		min-width: 2rem
		text-align: center

	&__progress-input
	&__volume-input
		height: 1.25rem
		margin: 0
		padding: 0
		appearance: none
		background: transparent
		cursor: pointer

		&::-webkit-slider-runnable-track
			height: 0.25rem
			border-radius: var(--shape-corner-full)
			background: linear-gradient(
				to right,
				var(--primary) 0,
				var(--primary) var(--music-progress, 0%),
				var(--surface-container-highest) var(--music-progress, 0%),
				var(--surface-container-highest) 100%
			)

		&::-webkit-slider-thumb
			appearance: none
			width: 0.625rem
			height: 0.625rem
			margin-top: -0.1875rem
			border: none
			border-radius: var(--shape-corner-full)
			background: var(--primary)
			transition: transform 160ms var(--m3e-easing-standard)

		&:hover::-webkit-slider-thumb
			transform: scale(1.25)

		&:focus-visible::-webkit-slider-thumb
			transform: scale(1.25)

		&::-moz-range-track
			height: 0.25rem
			border-radius: var(--shape-corner-full)
			background: var(--surface-container-highest)

		&::-moz-range-progress
			height: 0.25rem
			border-radius: var(--shape-corner-full)
			background: var(--primary)

		&::-moz-range-thumb
			width: 0.625rem
			height: 0.625rem
			border: none
			border-radius: var(--shape-corner-full)
			background: var(--primary)

		&:focus-visible
			outline: 2px solid var(--primary)
			outline-offset: 2px

		&:disabled
			cursor: default
			opacity: 0.5

	&__progress-input
		flex: 1
		min-width: 0

	&__volume-input
		width: 4.25rem
		flex-shrink: 0

	&__extras
		display: flex
		align-items: center
		justify-content: flex-end
		gap: 0.125rem
		margin-top: 0.125rem
		padding-left: 2.25rem

	&__volume
		display: flex
		align-items: center
		gap: 0.125rem
		min-width: 0
		margin-left: 0.125rem

	&__dock
		display: flex
		align-items: center
		justify-content: space-between
		gap: 0.125rem
		margin-top: 0.375rem
		padding-left: 2.25rem

	&__play
		display: inline-flex
		flex-shrink: 0
		margin-inline: 0.125rem

	&__disc
		position: absolute
		left: 0
		bottom: 0
		z-index: 2
		display: grid
		place-items: center
		width: 4rem
		height: 4rem
		padding: 0
		overflow: hidden
		border: 3px solid var(--surface)
		border-radius: var(--shape-corner-full)
		background: var(--surface-container-highest)
		box-shadow: 0 0 0 1px var(--outline-variant)
		color: var(--on-surface-variant)
		cursor: grab
		touch-action: none
		user-select: none
		-webkit-user-select: none

	&[data-dragging="true"] &__disc
		cursor: grabbing

	&__disc-spin
		display: grid
		place-items: center
		width: 100%
		height: 100%
		border-radius: inherit
		animation: music-capsule-spin 16s linear infinite
		animation-play-state: paused

		&.is-playing
			animation-play-state: running

		img
			display: block
			width: 100%
			height: 100%
			object-fit: cover
			-webkit-user-drag: none

		> :global(svg)
			width: 1.5rem
			height: 1.5rem

	&__playlist
		position: absolute
		bottom: calc(100% + 0.5rem)
		left: 1.75rem
		right: 0
		z-index: 3
		max-height: 16rem
		overflow-y: auto
		overscroll-behavior: contain
		padding: 0.375rem
		border: 1px solid var(--outline-variant)
		border-radius: var(--shape-corner-l)
		background: unquote("color-mix(in oklab, var(--card-bg) 94%, transparent)")
		-webkit-backdrop-filter: blur(12px)
		backdrop-filter: blur(12px)
		scrollbar-width: thin
		scrollbar-color: var(--scrollbar-bg) transparent

		&::-webkit-scrollbar
			width: 0.5rem

		&::-webkit-scrollbar-track
			background: transparent

		&::-webkit-scrollbar-thumb
			border: 2px solid transparent
			border-radius: var(--shape-corner-full)
			background: var(--scrollbar-bg)
			background-clip: padding-box

	&__playlist-restore
		display: flex
		align-items: center
		gap: 0.375rem
		width: 100%
		margin-bottom: 0.25rem
		padding: 0.375rem 0.5rem
		border: none
		border-radius: var(--shape-corner-m)
		background: unquote("color-mix(in oklab, var(--primary) 10%, transparent)")
		color: var(--primary)
		font: var(--m3e-type-label-medium)
		text-align: left
		cursor: pointer

		> :global(svg)
			width: 1rem
			height: 1rem

	&__playlist-row
		display: flex
		align-items: center
		gap: 0.125rem

	&__playlist-list
		display: flex
		flex-direction: column
		gap: 0.125rem
		margin: 0
		padding: 0
		list-style: none

	&__playlist-status
		margin: 0
		padding: 0.5rem 0.625rem
		color: var(--on-surface-variant)
		font: var(--m3e-type-label-medium)
		text-align: center

	&__track
		display: flex
		align-items: center
		gap: 0.5rem
		flex: 1
		min-width: 0
		padding: 0.25rem 0.375rem
		border: none
		border-radius: var(--shape-corner-m)
		background: transparent
		color: var(--on-surface)
		text-align: left
		cursor: pointer

		&[aria-current="true"]
			background: unquote("color-mix(in oklab, var(--primary) 12%, transparent)")

			strong
				color: var(--primary)

	&__track-remove
		display: grid
		place-items: center
		flex-shrink: 0
		width: 1.75rem
		height: 1.75rem
		padding: 0
		border: none
		border-radius: var(--shape-corner-full)
		background: transparent
		color: var(--on-surface-variant)
		cursor: pointer
		opacity: 0.55
		transition:
			opacity 160ms var(--m3e-easing-standard),
			color 160ms var(--m3e-easing-standard)

		> :global(svg)
			width: 1rem
			height: 1rem

		&:hover
			opacity: 1
			color: var(--on-surface)

		&:focus-visible
			opacity: 1
			color: var(--on-surface)

	&__track-cover
		display: grid
		place-items: center
		flex-shrink: 0
		width: 2.25rem
		height: 2.25rem
		overflow: hidden
		border-radius: var(--shape-corner-s)
		background: var(--secondary-container)
		color: var(--on-secondary-container)

		img
			width: 100%
			height: 100%
			object-fit: cover

		> :global(svg)
			width: 1rem
			height: 1rem

	&__track-copy
		display: flex
		flex-direction: column
		min-width: 0

		strong
			overflow: hidden
			font: var(--m3e-type-label-large)
			text-overflow: ellipsis
			white-space: nowrap

		span
			overflow: hidden
			color: var(--on-surface-variant)
			font: var(--m3e-type-label-small)
			text-overflow: ellipsis
			white-space: nowrap

@keyframes music-capsule-spin
	to
		transform: rotate(360deg)

/*
 * 歌词条：固定在视口最底端、宽度与页面一致。
 * 上沿用拉伸的 SVG 蒙版裁成一条连续浅弧，而不是只在两角倒圆。
 * pointer-events: none 保证不会拦住页面滚动与链接点击。
 */
.music-capsule__lyrics-bar
	position: fixed
	left: 0
	right: 0
	bottom: 0
	display: flex
	justify-content: center
	padding: 1.125rem 1rem calc(0.75rem + env(safe-area-inset-bottom))
	background: var(--card-bg)
	-webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 32' preserveAspectRatio='none'%3E%3Cpath d='M0 32V10Q50 -10 100 10V32Z' fill='%23000'/%3E%3C/svg%3E")
	mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 32' preserveAspectRatio='none'%3E%3Cpath d='M0 32V10Q50 -10 100 10V32Z' fill='%23000'/%3E%3C/svg%3E")
	-webkit-mask-size: 100% 100%
	mask-size: 100% 100%
	-webkit-mask-repeat: no-repeat
	mask-repeat: no-repeat
	pointer-events: none
	user-select: none
	-webkit-user-select: none

.music-capsule__lyrics-inner
	display: flex
	flex-direction: column
	align-items: center
	gap: 0.125rem
	width: 100%
	max-width: 48rem
	margin-inline: auto
	text-align: center

.music-capsule__lyrics-line
	margin: 0
	color: var(--on-surface-variant)
	font: var(--m3e-type-label-large)
	line-height: 1.4
	text-wrap: balance

	&.is-active
		color: var(--primary)
		font: var(--m3e-type-title-small)

@media (prefers-reduced-motion: reduce)
	.music-capsule
		&
		&__panel
		&__surface
			transition: none

	&__disc-spin
		animation: none
</style>
