/**
 * Keep album derivatives in step with the album sources.
 *
 * Runs from the integration so both repo mode and package mode get the same
 * behaviour. Outputs live in `public/`, which Astro copies verbatim, so
 * `buildStart` is early enough.
 */

import type { Plugin } from "vite";
import type { ResolvedShironesPaths } from "../../types.ts";
import { generateAlbumImages } from "./generate.ts";

const IMAGE_EXTENSIONS = /\.(avif|jpeg|jpg|png|webp)$/i;
const DEBOUNCE_MS = 300;

const pending = new Map<string, ReturnType<typeof setTimeout>>();

/** One report per process; a build runs several Vite environments. */
let reportedThisProcess = false;

export function shironesAlbumImagesRegeneration(
	paths: ResolvedShironesPaths,
): Plugin {
	let isBuild = false;

	const generate = async () => {
		try {
			const result = await generateAlbumImages({
				projectRoot: paths.projectRoot,
			});
			if (reportedThisProcess) return;
			reportedThisProcess = true;
			const summary =
				result.generated > 0 ? `Generated ${result.generated}` : "Reused";
			const pruned =
				result.removed > 0 ? `; removed ${result.removed} stale files` : "";
			console.log(
				`[album-images] ${summary} derivatives for ${result.total} album images${pruned}.`,
			);
		} catch (error) {
			// A broken image should not stop `astro dev`, but a build that ships
			// without grid previews means every album falls back to full-size
			// originals, so fail loudly there.
			const message = `[album-images] generation failed: ${(error as Error).message}`;
			if (isBuild) throw new Error(message, { cause: error });
			console.warn(message);
		}
	};

	return {
		name: "shirone:album-images-regeneration",

		configResolved(config) {
			isBuild = config.command === "build";
		},

		async buildStart() {
			await generate();
		},

		handleHotUpdate({ file }) {
			if (!IMAGE_EXTENSIONS.test(file)) return;
			const root = paths.projectRoot;
			clearTimeout(pending.get(root));
			pending.set(
				root,
				setTimeout(() => {
					void generate();
				}, DEBOUNCE_MS),
			);
		},
	};
}
