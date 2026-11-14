<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import { openFancyboxGallery } from "@utils/fancybox-handler";
import { url } from "@utils/url-utils";
import type { AlbumLayout, AlbumPhoto } from "@/types/album";

let {
	photos = [] as AlbumPhoto[],
	layout = "masonry" as AlbumLayout,
	columns = 3,
}: {
	photos?: AlbumPhoto[];
	layout?: AlbumLayout;
	columns?: 2 | 3 | 4;
} = $props();

let measuredRatios = $state<Record<string, number>>({});

function photoRatio(photo: AlbumPhoto): number | undefined {
	if (photo.width && photo.height) return photo.width / photo.height;
	return measuredRatios[photo.id];
}

function orientationPriority(photo: AlbumPhoto): number {
	// Only authoritative metadata may affect ordering; measured image ratios arrive
	// asynchronously and must not reshuffle an already rendered masonry grid.
	const value =
		photo.width && photo.height ? photo.width / photo.height : undefined;
	if (value === undefined || value === 1) return 1;
	return value < 1 ? 0 : 2;
}

const visiblePhotos = $derived.by(() => {
	if (layout !== "masonry") return photos;
	return photos
		.map((photo, index) => ({ photo, index }))
		.sort(
			(a, b) =>
				orientationPriority(a.photo) - orientationPriority(b.photo) ||
				a.index - b.index,
		)
		.map(({ photo }) => photo);
});

function rememberNaturalRatio(photo: AlbumPhoto, event: Event) {
	if (photo.width && photo.height) return;
	const image = event.currentTarget as HTMLImageElement;
	if (!image.naturalWidth || !image.naturalHeight) return;
	measuredRatios[photo.id] = image.naturalWidth / image.naturalHeight;
}

function openPhoto(event: MouseEvent, photo: AlbumPhoto) {
	event.preventDefault();
	event.stopPropagation();
	const fullSrc = photo.src ? url(photo.src) : "";
	void openFancyboxGallery([{ src: fullSrc }]);
}

function ratio(photo: AlbumPhoto): string {
	const value = photoRatio(photo);
	return value === undefined ? "4 / 3" : String(value);
}

function creditHref(photo: AlbumPhoto): string | undefined {
	const source = photo.source?.trim();
	return source && /^https?:\/\//i.test(source) ? source : undefined;
}

function creditLabel(photo: AlbumPhoto): string {
	if (photo.author) return photo.author;
	const href = creditHref(photo);
	if (href) {
		try {
			return new URL(href).hostname.replace(/^www\./, "");
		} catch {
			// Fall back to the AI label when the URL cannot be parsed.
		}
	}
	return i18n(I18nKey.imageAiLabel);
}
</script>

{#if visiblePhotos.length > 0}
			<div
				class="album-gallery album-gallery--{layout}"
				style={`--album-columns: ${columns}`}
				role="list"
				aria-label={i18n(I18nKey.imageViewer)}
			>
		{#each visiblePhotos as photo, index (photo.id)}
			{@const href = creditHref(photo)}
			<div class="album-gallery__cell" role="listitem">
				<button
					type="button"
						class="album-gallery__item"
						style={`--album-photo-ratio: ${ratio(photo)}`}
						aria-label={`${i18n(I18nKey.openImage)} ${index + 1}: ${photo.alt}`}
							onclick={(event) => openPhoto(event, photo)}
					>
						<img
						src={url(photo.thumbnail || photo.src)}
							alt={photo.alt}
							width={photo.width}
							height={photo.height}
							loading="lazy"
						decoding="async"
						referrerpolicy="no-referrer"
						onload={(event) => rememberNaturalRatio(photo, event)}
						/>
					</button>
				{#if href}
					<a
						class="album-gallery__credit"
						href={href}
						target="_blank"
						rel="noopener noreferrer nofollow"
					>
						{creditLabel(photo)}
					</a>
				{:else}
					<span class="album-gallery__credit">{creditLabel(photo)}</span>
				{/if}
			</div>
		{/each}
	</div>
{:else}
	<div class="album-gallery__empty">
		<Icon icon="material-symbols:photo-library-outline-rounded" aria-hidden="true" />
		<span>{i18n(I18nKey.noData)}</span>
	</div>
{/if}

<style lang="stylus">
.album-gallery
	--album-gap: var(--m3e-space-3, 0.75rem)
	width: 100%

	&--grid
		display: grid
		grid-template-columns: repeat(var(--album-columns), minmax(0, 1fr))
		gap: var(--album-gap)

	&--masonry
		direction: ltr
		column-width: 240px
		column-gap: var(--album-gap)
		column-fill: balance

	&__cell
		position: relative
		margin: 0 0 var(--album-gap)
		break-inside: avoid

	&__item
		position: relative
		display: block
		width: 100%
		padding: 0
		overflow: hidden
		border: 0
		border-radius: var(--shape-corner-m)
		background: var(--surface-container-high)
		color: inherit
		cursor: zoom-in
		font: inherit
		text-align: start
		&:focus-visible
			outline: 2px solid var(--primary)
			outline-offset: 2px
		> img
			display: block
			width: 100%
			max-width: 100%
			aspect-ratio: var(--album-photo-ratio)
			object-fit: cover
			transition: transform var(--m3e-duration-medium) var(--m3e-easing-emphasized-decelerate), filter var(--m3e-duration-medium) var(--m3e-easing-standard)
		.album-gallery--masonry & > img
			aspect-ratio: auto
			object-fit: cover

	&__item:hover > img
		transform: scale(1.025)
		filter: brightness(0.92)

	&__credit
		position: absolute
		inset-inline-start: 0.5rem
		bottom: 0.5rem
		z-index: 1
		max-width: calc(100% - 1rem)
		overflow: hidden
		padding: 0.125rem 0.5rem
		border-radius: var(--shape-corner-full)
		background: unquote("color-mix(in srgb, var(--surface-container-highest) 84%, transparent)")
		color: var(--on-surface)
		font: var(--m3e-type-label-small)
		line-height: 1.5
		text-decoration: none
		text-overflow: ellipsis
		white-space: nowrap
		backdrop-filter: blur(6px)
		&:hover
			background: var(--surface-container-highest)
		&:focus-visible
			outline: 2px solid var(--primary)
			outline-offset: 2px

	&__empty
		display: grid
		place-items: center
		gap: 0.5rem
		min-height: 12rem
		color: var(--on-surface-variant)
		font: var(--m3e-type-body-medium)
		> :global(svg)
			width: 2rem
			height: 2rem

span.album-gallery__credit
	pointer-events: none

@media (max-width: 47.99rem)
	.album-gallery--masonry
		column-width: 180px

@media (max-width: 29.99rem)
	.album-gallery--masonry
		column-width: 140px
	.album-gallery--grid
		grid-template-columns: repeat(2, minmax(0, 1fr))

:global(html.motion-reduced) .album-gallery__item > img
	transition: none

@media (prefers-reduced-motion: reduce)
	.album-gallery__item > img
		transition: none
</style>
