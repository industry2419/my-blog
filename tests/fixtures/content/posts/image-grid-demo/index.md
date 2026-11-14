---
title: "Image Gallery Grid: Syntax and Complete Examples"
published: 2026-07-13
description: "A complete guide to image gallery grid syntax, parameters, cropping, responsive behavior, captions, and lightbox navigation."
tags: [Markdown, Gallery, Image Grid, Demo]
category: "Examples"
draft: false
---

`:::grid` is the blog's image gallery container directive. It arranges ordinary Markdown images in a responsive grid with a consistent aspect ratio and automatically enables lightbox viewing. Use it for article images, screenshots, portfolios, or small albums.

Images in the same gallery use the same card ratio. By default, center cropping fills every card and keeps each row tidy; clicking an image opens the complete original in a lightbox. Every gallery has its own lightbox group and does not mix with other images in the post.

> This post is both feature documentation and a visual test page. View the examples at desktop, tablet, and mobile widths, then click any image to verify lightbox grouping.

## Minimal Syntax

Write Markdown images directly between `:::grid` and the closing `:::`:

````markdown
:::grid
![Image description](/images/albums/DesktopWallpaper/desktop.webp)

![Image description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

Each image must occupy its own paragraph, with a blank line between images. Keep only images in a gallery; write paragraphs, lists, and code blocks outside the container.

Here is the result of the minimal syntax. Without parameters, the grid uses three columns, a `16/10` ratio, and `cover` by default.

:::grid
![Minimal syntax result: first image](/images/albums/DesktopWallpaper/desktop.webp)

![Minimal syntax result: second image](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Parameters at a Glance

Write all parameters in braces after the opening directive: `:::grid{parameter="value"}`.

| Parameter | Allowed values | Default | Purpose |
| --- | --- | --- | --- |
| `columns` | Integers from `1` to `6` | `3` | Number of columns per row on desktop. Invalid values fall back to `3`. |
| `aspect` | A positive ratio, such as `16/9`, `3/4`, or `1/1` | `16/10` | The displayed card ratio, not the original image ratio. |
| `fit` | `cover`, `contain` | `cover` | Image fitting mode. `cover` crops to fill; `contain` preserves the complete image and may leave empty space. |

Complete example:

````markdown
:::grid{columns="3" aspect="16/9" fit="cover"}
![First image](/images/albums/DesktopWallpaper/desktop.webp "Optional caption")

![Second image](/images/albums/DesktopWallpaper/desktop.webp "Optional caption")

![Third image](/images/albums/DesktopWallpaper/desktop.webp "Optional caption")
:::
````

The following result uses the three-column landscape syntax above. Compare the card ratio, column count, and the way a title takes precedence over alt text as the caption:

:::grid{columns="3" aspect="16/9" fit="cover"}
![Parameter example: first landscape image](/images/albums/DesktopWallpaper/desktop.webp "Landscape caption 1")

![Parameter example: second landscape image](/images/albums/DesktopWallpaper/desktop.webp "Landscape caption 2")

![Parameter example: third landscape image](/images/albums/DesktopWallpaper/desktop.webp "Landscape caption 3")
:::

## Captions and Alt Text

An image's alt text serves both as accessible alternative text and as its default caption. When an image has an optional title, the title is used as the caption instead:

```markdown
![Text used for accessibility](/images/albums/DesktopWallpaper/desktop.webp "Caption shown below the image")
```

In the same row, captions align to the bottom of every card. A wrapping caption does not make the others float at a different height. Ratio text such as `3:4` and `16:9` can be written directly in body text, headings, and alt text without escaping.

This example demonstrates the default alt-text caption, an explicit title caption, and bottom alignment for a longer caption:

:::grid{columns="3" aspect="1/1"}
![This image has no title, so its alt text is the caption](/images/albums/DesktopWallpaper/desktop.webp)

![Second square image with accessible alt text](/images/albums/DesktopWallpaper/desktop.webp "This title is displayed as the caption")

![Accessible description of a 3:4 poster](/images/albums/DesktopWallpaper/desktop.webp "This is a longer caption for checking that every caption remains aligned to the bottom of its card when it wraps")
:::

## Layout and Cropping

Desktop layouts use the number of columns specified by `columns`. Below `768px`, grids use at most two columns; below `480px`, they switch to one column. The card wrapper fixes the `aspect` ratio and clips rounded corners, while the image fills the card without the theme's default image margins.

- Choose `cover`: the recommended default. Images are cropped from the center to fill the card, making the gallery look consistent.
- Choose `contain`: the full original image is shown without cropping. When its ratio differs from the card, the theme background remains visible; use this for images that cannot be cropped.
- To preserve the complete image without empty space, set `aspect` close to the original image ratio or place the image in a grid of its own.

The following examples place the same portrait images in `16/9` cards with `cover` and `contain`. The first crops them; the second preserves the full image and leaves background space.

````markdown
:::grid{columns="3" aspect="16/9" fit="cover"}
![Image description](/images/albums/DesktopWallpaper/desktop.webp "Optional caption")

![Image description](/images/albums/DesktopWallpaper/desktop.webp "Optional caption")
:::

:::grid{columns="3" aspect="16/9" fit="contain"}
![Image description](/images/albums/DesktopWallpaper/desktop.webp "Optional caption")

![Image description](/images/albums/DesktopWallpaper/desktop.webp "Optional caption")
:::
````

:::grid{columns="3" aspect="16/9" fit="cover"}
![First cover result](/images/albums/DesktopWallpaper/desktop.webp "Cover: center crop")

![Second cover result](/images/albums/DesktopWallpaper/desktop.webp "Cover: fill the card")

![Third cover result](/images/albums/DesktopWallpaper/desktop.webp "Cover: a more consistent layout")
:::

:::grid{columns="3" aspect="16/9" fit="contain"}
![First contain result](/images/albums/DesktopWallpaper/desktop.webp "Contain: preserve the complete original")

![Second contain result](/images/albums/DesktopWallpaper/desktop.webp "Contain: empty space may appear")

![Third contain result](/images/albums/DesktopWallpaper/desktop.webp "Contain: suitable for edge details")
:::

## Default Configuration

Without attributes, the default is three columns, a `16/10` ratio, and `cover` cropping. These three portrait images verify default cropping and captions.

````markdown
:::grid
![Image description](/images/albums/DesktopWallpaper/desktop.webp)

![Image description](/images/albums/DesktopWallpaper/desktop.webp)

![Image description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid
![Default configuration: portrait image one](/images/albums/DesktopWallpaper/desktop.webp)

![Default configuration: portrait image two](/images/albums/DesktopWallpaper/desktop.webp)

![Default configuration: portrait image three](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Three-Column Portraits: 3:4

With `aspect="3/4"`, the three portrait images fill consistently proportioned vertical cards. If an original image has a different ratio, `cover` crops its edges from the center.

````markdown
:::grid{columns="3" aspect="3/4"}
![Portrait image description](/images/albums/DesktopWallpaper/desktop.webp)

![Portrait image description](/images/albums/DesktopWallpaper/desktop.webp)

![Portrait image description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid{columns="3" aspect="3/4"}
![3:4 test image one](/images/albums/DesktopWallpaper/desktop.webp "Portrait 1")

![3:4 test image two](/images/albums/DesktopWallpaper/desktop.webp "Portrait 2")

![3:4 test image three](/images/albums/DesktopWallpaper/desktop.webp "Portrait 3")
:::

## Three-Column Landscapes: 16:9

This set demonstrates a common video-cover ratio in a three-column layout. Cropping is minimal when the landscape images are close to the card ratio.

````markdown
:::grid{columns="3" aspect="16/9"}
![Landscape image description](/images/albums/DesktopWallpaper/desktop.webp)

![Landscape image description](/images/albums/DesktopWallpaper/desktop.webp)

![Landscape image description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid{columns="3" aspect="16/9"}
![16:9 test image one](/images/albums/DesktopWallpaper/desktop.webp)

![16:9 test image two](/images/albums/DesktopWallpaper/desktop.webp)

![16:9 test image three](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Two-Column Squares: 1:1

Two columns work well when larger preview cards are needed. The third image moves to the next row. The final row keeps its grid-track width instead of stretching images to fill the row.

````markdown
:::grid{columns="2" aspect="1/1"}
![Square image description](/images/albums/DesktopWallpaper/desktop.webp)

![Square image description](/images/albums/DesktopWallpaper/desktop.webp)

![Square image description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid{columns="2" aspect="1/1"}
![1:1 test image one](/images/albums/DesktopWallpaper/desktop.webp)

![1:1 test image two](/images/albums/DesktopWallpaper/desktop.webp)

![1:1 test image three](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Four Columns with `contain`

`fit="contain"` does not crop the original image. When the image ratio differs from the card ratio, the theme background remains visible. This is intentional, not a layout issue. It also verifies that four-column grids and separate lightbox groups do not interfere with each other.

````markdown
:::grid{columns="4" aspect="16/9" fit="contain"}
![Image description](/images/albums/DesktopWallpaper/desktop.webp)

![Image description](/images/albums/DesktopWallpaper/desktop.webp)

![Image description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid{columns="4" aspect="16/9" fit="contain"}
![Contain: portrait image one](/images/albums/DesktopWallpaper/desktop.webp)

![Contain: portrait image two](/images/albums/DesktopWallpaper/desktop.webp)

![Contain: portrait image three](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Single-Column Detail Image

One column is suitable when an image needs a larger reading size. It remains one column on desktop, tablet, and mobile, and the original is still available in the lightbox.

````markdown
:::grid{columns="1" aspect="16/9"}
![Image description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid{columns="1" aspect="16/9"}
![Single-column test image](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Sparse Five-Column Row

Five columns verify a higher supported column count. With only three images, the final row remains left-aligned instead of stretching the images.

````markdown
:::grid{columns="5" aspect="1/1"}
![Thumbnail description](/images/albums/DesktopWallpaper/desktop.webp)

![Thumbnail description](/images/albums/DesktopWallpaper/desktop.webp)

![Thumbnail description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid{columns="5" aspect="1/1"}
![Five-column test image one](/images/albums/DesktopWallpaper/desktop.webp)

![Five-column test image two](/images/albums/DesktopWallpaper/desktop.webp)

![Five-column test image three](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Mixed Images in Six Columns

Six columns are the current maximum. Mixing landscape and portrait images verifies `cover` cropping, captions on narrow cards, and a dense desktop layout. For readable article content, two to four columns are usually preferable.

````markdown
:::grid{columns="6" aspect="1/1"}
![Image description](/images/albums/DesktopWallpaper/desktop.webp)

![Image description](/images/albums/DesktopWallpaper/desktop.webp)

![Image description](/images/albums/DesktopWallpaper/desktop.webp)

![Image description](/images/albums/DesktopWallpaper/desktop.webp)

![Image description](/images/albums/DesktopWallpaper/desktop.webp)

![Image description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid{columns="6" aspect="1/1"}
![Six-column test image one](/images/albums/DesktopWallpaper/desktop.webp)

![Six-column test image two](/images/albums/DesktopWallpaper/desktop.webp)

![Six-column test image three](/images/albums/DesktopWallpaper/desktop.webp)

![Six-column test image four](/images/albums/DesktopWallpaper/desktop.webp)

![Six-column test image five](/images/albums/DesktopWallpaper/desktop.webp)

![Six-column test image six](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Four-Column Squares: 1:1

Four square images with the same ratio are a typical four-column layout. Desktop displays all four in one row; tablet collapses to two columns and mobile to one.

````markdown
:::grid{columns="4" aspect="1/1"}
![Square image description](/images/albums/DesktopWallpaper/desktop.webp)

![Square image description](/images/albums/DesktopWallpaper/desktop.webp)

![Square image description](/images/albums/DesktopWallpaper/desktop.webp)

![Square image description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid{columns="4" aspect="1/1"}
![Square image one](/images/albums/DesktopWallpaper/desktop.webp)

![Square image two](/images/albums/DesktopWallpaper/desktop.webp)

![Square image three](/images/albums/DesktopWallpaper/desktop.webp)

![Square image four](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Six-Column Landscapes: 16:9

Six landscape columns work well for thumbnail previews, portfolios, and screenshot indexes. Even if original ratios differ slightly, `cover` fills every `16/9` card consistently.

````markdown
:::grid{columns="6" aspect="16/9"}
![Landscape image description](/images/albums/DesktopWallpaper/desktop.webp)

![Landscape image description](/images/albums/DesktopWallpaper/desktop.webp)

![Landscape image description](/images/albums/DesktopWallpaper/desktop.webp)

![Landscape image description](/images/albums/DesktopWallpaper/desktop.webp)

![Landscape image description](/images/albums/DesktopWallpaper/desktop.webp)

![Landscape image description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid{columns="6" aspect="16/9"}
![Landscape image one](/images/albums/DesktopWallpaper/desktop.webp)

![Landscape image two](/images/albums/DesktopWallpaper/desktop.webp)

![Landscape image three](/images/albums/DesktopWallpaper/desktop.webp)

![Landscape image four](/images/albums/DesktopWallpaper/desktop.webp)

![Landscape image five](/images/albums/DesktopWallpaper/desktop.webp)

![Landscape image six](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Three-Column Portraits: 3:4

This group of six portrait images demonstrates a common layout for people, posters, or mobile screenshots. The images form two rows of three, with captions aligned to the bottom.

````markdown
:::grid{columns="3" aspect="3/4"}
![Portrait image description](/images/albums/DesktopWallpaper/desktop.webp)

![Portrait image description](/images/albums/DesktopWallpaper/desktop.webp)

![Portrait image description](/images/albums/DesktopWallpaper/desktop.webp)

![Portrait image description](/images/albums/DesktopWallpaper/desktop.webp)

![Portrait image description](/images/albums/DesktopWallpaper/desktop.webp)

![Portrait image description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid{columns="3" aspect="3/4"}
![Portrait image one](/images/albums/DesktopWallpaper/desktop.webp)

![Portrait image two](/images/albums/DesktopWallpaper/desktop.webp)

![Portrait image three](/images/albums/DesktopWallpaper/desktop.webp)

![Portrait image four](/images/albums/DesktopWallpaper/desktop.webp)

![Portrait image five](/images/albums/DesktopWallpaper/desktop.webp)

![Portrait image six](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Edge-Critical Content: `cover` and Lightbox

These images contain important text or details near their edges. `cover` keeps the grid tidy but may crop those edges; click an image to view the uncropped original in the lightbox. Use clear captions for edge-sensitive images, or use `contain` below.

````markdown
:::grid{columns="3" aspect="16/9" fit="cover"}
![Edge-critical content](/images/albums/DesktopWallpaper/desktop.webp "Open the lightbox to view the complete edge content")

![Edge-critical content](/images/albums/DesktopWallpaper/desktop.webp "Open the lightbox to view the complete edge content")

![Edge-critical content](/images/albums/DesktopWallpaper/desktop.webp "Open the lightbox to view the complete edge content")
:::
````

:::grid{columns="3" aspect="16/9" fit="cover"}
![First edge-critical image](/images/albums/DesktopWallpaper/desktop.webp "Open the lightbox to view the complete edge content")

![Second edge-critical image](/images/albums/DesktopWallpaper/desktop.webp "Open the lightbox to view the complete edge content")

![Third edge-critical image](/images/albums/DesktopWallpaper/desktop.webp "Open the lightbox to view the complete edge content")
:::

## Extreme Ratios with `contain`

For banners, long screenshots, and other extreme image ratios, `contain` displays the complete original. Unlike `cover`, it may leave theme-background space, but it never crops content.

````markdown
:::grid{columns="3" aspect="16/9" fit="contain"}
![Complete screenshot description](/images/albums/DesktopWallpaper/desktop.webp)

![Complete screenshot description](/images/albums/DesktopWallpaper/desktop.webp)

![Complete screenshot description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid{columns="3" aspect="16/9" fit="contain"}
![Extreme-ratio image one](/images/albums/DesktopWallpaper/desktop.webp)

![Extreme-ratio image two](/images/albums/DesktopWallpaper/desktop.webp)

![Extreme-ratio image three](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Transparent Images

Transparent images reveal the card's theme background. This single-column `contain` example makes the transparent areas, original edges, and lightbox behavior easy to inspect.

````markdown
:::grid{columns="1" aspect="16/9" fit="contain"}
![Transparent image description](/images/albums/DesktopWallpaper/desktop.webp)
:::
````

:::grid{columns="1" aspect="16/9" fit="contain"}
![Transparent-background test image](/images/albums/DesktopWallpaper/desktop.webp)
:::

## Lightbox Navigation

Click any image in a grid to open the Fancybox lightbox. There you can zoom, rotate, enter fullscreen, view thumbnails, and navigate with the arrow keys. Navigation is limited to the current `:::grid` container: for example, clicking "16:9 test image one" only opens the other two landscape images in that section.

Ordinary Markdown images in the same post continue to be handled separately; they are not added to any grid gallery.

## Checklist

1. Images in each grid have consistent dimensions, with captions below the cards.
2. Images scale slightly on hover; after clicking, they can be zoomed, rotated, and navigated with the keyboard.
3. Clicking "16:9 test image one" lets the lightbox browse only the other two landscape images in that section.
4. Below 768px, grids use at most two columns; below 480px, they use one column.
5. Portrait images in "Four Columns with `contain`" are fully visible with empty space and no cropping.
6. Five- and six-column grids retain their specified column count on wide screens, then collapse to two or one column according to the responsive rules.
