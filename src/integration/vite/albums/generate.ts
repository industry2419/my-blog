/**
 * Album image derivatives.
 *
 * Album photos are published verbatim: `public/` is copied as-is, so a 900 KB
 * camera export costs the grid the same bytes it costs the lightbox. This
 * generator writes downscaled copies for the grid and for album covers while
 * leaving every source file untouched — the lightbox keeps pointing at the
 * original, which is what lets visitors still reach the lossless image.
 *
 * Freshness is decided by hashing the source, not by mtime: `content:sync`
 * rewrites mtimes on every run, so an mtime check would regenerate everything
 * each time. The digest also makes an unchanged re-run a no-op.
 */

import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { CACHE_DIR_NAME } from "../../resolve/paths.ts";

/** Wider than the largest masonry column at 3x, so the grid stays sharp. */
const PHOTO_WIDTH = 960;
const PHOTO_QUALITY = 68;
const COVER_WIDTH = 1200;
const COVER_QUALITY = 72;

const SUPPORTED_EXTENSIONS = new Set([
	".avif",
	".jpeg",
	".jpg",
	".png",
	".webp",
]);

const COVER_PATTERN = /^cover\.(?:avif|jpeg|jpg|png|webp)$/i;

export interface AlbumImageOptions {
	/** Project root; sources and outputs are resolved beneath it. */
	projectRoot: string;
	/** Where album folders live, relative to `projectRoot`. */
	sourceDir?: string;
	/** Where derivatives are written, relative to `projectRoot`. */
	outputDir?: string;
	/** Remove derivatives whose source is gone. Defaults to `true`. */
	prune?: boolean;
	/** Where the digest cache lives. Defaults to `.shirones/album-images.json`. */
	cachePath?: string;
}

export interface AlbumImageResult {
	generated: number;
	removed: number;
	total: number;
}

async function listEntries(directory: string): Promise<Dirent[]> {
	try {
		return await fs.readdir(directory, { withFileTypes: true });
	} catch {
		return [];
	}
}

async function hashFile(filePath: string): Promise<string> {
	return createHash("sha256")
		.update(await fs.readFile(filePath))
		.digest("hex");
}

async function hasUsableOutput(outputPath: string): Promise<boolean> {
	try {
		return (await fs.stat(outputPath)).size > 0;
	} catch {
		return false;
	}
}

async function readCache(cachePath: string): Promise<Record<string, string>> {
	try {
		const parsed = JSON.parse(await fs.readFile(cachePath, "utf8"));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, string>)
			: {};
	} catch {
		return {};
	}
}

async function collectOutputs(directory: string): Promise<string[]> {
	const outputs: string[] = [];
	for (const entry of await listEntries(directory)) {
		const absolutePath = path.join(directory, entry.name);
		if (entry.isDirectory()) {
			outputs.push(...(await collectOutputs(absolutePath)));
		} else if (
			SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
		) {
			outputs.push(absolutePath);
		}
	}
	return outputs;
}

/**
 * Generate grid-sized previews and cover previews for every album. Sources are
 * read only; the originals under `sourceDir` are never modified.
 */
export async function generateAlbumImages({
	projectRoot,
	sourceDir = "public/images/albums",
	outputDir = "public/assets/albums",
	prune = true,
	cachePath: cachePathOption,
}: AlbumImageOptions): Promise<AlbumImageResult> {
	const sourceRoot = path.resolve(projectRoot, sourceDir);
	const outputRoot = path.resolve(projectRoot, outputDir);
	const cachePath =
		cachePathOption ??
		path.join(projectRoot, CACHE_DIR_NAME, "album-images.json");
	await fs.mkdir(path.dirname(cachePath), { recursive: true });

	// Published directories are copied verbatim, so a cache file inside one
	// would be served at a guessable URL.
	const legacyCache = path.join(outputRoot, ".cache.json");
	if (legacyCache !== cachePath && existsSync(legacyCache)) {
		await fs.rm(legacyCache, { force: true });
	}

	const albumDirs = (await listEntries(sourceRoot)).filter((entry) =>
		entry.isDirectory(),
	);
	const previousCache = await readCache(cachePath);
	const nextCache: Record<string, string> = {};
	const expectedOutputs = new Set<string>();
	let generated = 0;
	let total = 0;

	for (const albumEntry of albumDirs) {
		const albumDir = path.join(sourceRoot, albumEntry.name);
		for (const fileEntry of await listEntries(albumDir)) {
			if (!fileEntry.isFile()) continue;
			const extension = path.extname(fileEntry.name).toLowerCase();
			if (!SUPPORTED_EXTENSIONS.has(extension)) continue;

			const isCover = COVER_PATTERN.test(fileEntry.name);
			const sourcePath = path.join(albumDir, fileEntry.name);
			const outputPath = path.join(
				outputRoot,
				albumEntry.name,
				isCover ? "cover.webp" : `${path.parse(fileEntry.name).name}.webp`,
			);
			const cacheKey = `${albumEntry.name}/${fileEntry.name}`;
			total += 1;
			expectedOutputs.add(path.resolve(outputPath).toLowerCase());

			const digest = await hashFile(sourcePath);
			if (
				previousCache[cacheKey] === digest &&
				(await hasUsableOutput(outputPath))
			) {
				nextCache[cacheKey] = digest;
				continue;
			}

			await fs.mkdir(path.dirname(outputPath), { recursive: true });
			const pipeline = sharp(sourcePath).rotate();
			await (isCover
				? pipeline.resize({ width: COVER_WIDTH, withoutEnlargement: true })
				: pipeline.resize({ width: PHOTO_WIDTH, withoutEnlargement: true })
			)
				.webp({
					quality: isCover ? COVER_QUALITY : PHOTO_QUALITY,
					effort: 5,
					smartSubsample: true,
				})
				.toFile(outputPath);
			generated += 1;
			nextCache[cacheKey] = digest;
		}
	}

	await fs.mkdir(outputRoot, { recursive: true });
	let removed = 0;
	// "No sources" only means "nothing to derive" when the source tree is
	// actually missing, not when a project simply has no albums.
	const canPrune = prune && existsSync(sourceRoot);
	if (canPrune) {
		for (const outputPath of await collectOutputs(outputRoot)) {
			if (expectedOutputs.has(path.resolve(outputPath).toLowerCase())) continue;
			await fs.unlink(outputPath);
			removed += 1;
		}
	}

	await fs.writeFile(cachePath, `${JSON.stringify(nextCache, null, 2)}\n`);

	return { generated, removed, total };
}
