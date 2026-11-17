/**
 * 点击闪电特效运行时（皮卡丘放电风格）。
 *
 * 契约：
 * - 只在浏览器挂载时创建一张 fixed 全屏 canvas（pointer-events: none），
 *   DPR 上限 2；不插入任何可交互 DOM，不改变布局。
 * - 事件委托挂在 document 的 pointerdown 上，鼠标左键/触控笔触发；
 *   触屏点击不触发（避免影响滚动与点按），`[data-no-fx]` 区域跳过。
 * - rAF 只在有活动粒子时运行，空闲后自动停止，零常驻帧开销。
 * - 有效模式取访客偏好与 `prefersReducedMotion()` 的交集：减弱模式下
 *   只保留一圈快速扩散的光环，不画闪电、火星与全屏闪。
 * - 面板/壳层不会被 Swup 替换，组件只需初始化一次，由调用方在销毁时释放。
 */

import { prefersReducedMotion } from "@utils/motion";
import type { ResolvedClickEffectOptions } from "@/types/clickEffectConfig";

export type ClickLightningMode = "full" | "subtle";

export type ClickLightningHandle = {
	/** 切换全量 / 减弱模式（访客偏好变化时调用）。 */
	setMode: (mode: ClickLightningMode) => void;
	/** 移除监听、停止动画并删除画布。 */
	destroy: () => void;
};

type Rgb = { r: number; g: number; b: number };

type Bolt = {
	x: number;
	y: number;
	angle: number;
	len: number;
	width: number;
	life: number;
	depth: number;
	age: number;
	pts: [number, number][] | null;
	nextRegen: number;
};

type Ring = { x: number; y: number; age: number; life: number; r1: number };
type Spark = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	age: number;
	life: number;
	size: number;
};
type Flash = { x: number; y: number; age: number; life: number; r1: number };

const MAX_BOLTS = 220;
const RING_MIN_RADIUS = 6;

function parseHex(hex: string): Rgb {
	const raw = hex.replace("#", "");
	const full =
		raw.length === 3
			? raw
					.split("")
					.map((char) => char + char)
					.join("")
			: raw;
	const value = Number.parseInt(full, 16);
	return {
		r: (value >> 16) & 255,
		g: (value >> 8) & 255,
		b: value & 255,
	};
}

function rgba(rgb: Rgb, alpha: number): string {
	return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha.toFixed(3)})`;
}

/** 向白色混合，用于电弧白芯与火星。 */
function towardWhite(rgb: Rgb, amount: number): Rgb {
	const mix = (channel: number) =>
		Math.round(channel + (255 - channel) * amount);
	return { r: mix(rgb.r), g: mix(rgb.g), b: mix(rgb.b) };
}

/** 递归中点位移，把一条直线折成锯齿闪电。 */
function jagged(
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	depth: number,
	offset: number,
): [number, number][] {
	const points: [number, number][] = [[x0, y0]];
	const subdivide = (
		ax: number,
		ay: number,
		bx: number,
		by: number,
		level: number,
		amount: number,
	) => {
		if (level <= 0) {
			points.push([bx, by]);
			return;
		}
		const mx = (ax + bx) / 2;
		const my = (ay + by) / 2;
		const dx = bx - ax;
		const dy = by - ay;
		const len = Math.hypot(dx, dy) || 1;
		const shift = (Math.random() - 0.5) * 2 * amount;
		const px = mx + (-dy / len) * shift;
		const py = my + (dx / len) * shift;
		subdivide(ax, ay, px, py, level - 1, amount * 0.55);
		subdivide(px, py, bx, by, level - 1, amount * 0.55);
	};
	subdivide(x0, y0, x1, y1, depth, offset);
	return points;
}

export function createClickLightning(
	options: ResolvedClickEffectOptions,
	initialMode: ClickLightningMode,
): ClickLightningHandle {
	const canvas = document.createElement("canvas");
	canvas.dataset.clickLightning = "";
	canvas.setAttribute("aria-hidden", "true");
	canvas.style.cssText =
		"position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60";
	document.body.append(canvas);

	const renderingContext = canvas.getContext("2d");
	if (!renderingContext) {
		canvas.remove();
		return { setMode: () => {}, destroy: () => {} };
	}
	const ctx: CanvasRenderingContext2D = renderingContext;

	const boltColor = parseHex(options.color);
	const coreColor = towardWhite(boltColor, 0.92);
	const sparkColor = towardWhite(boltColor, 0.55);

	let mode = initialMode;
	let vw = 0;
	let vh = 0;

	const bolts: Bolt[] = [];
	const rings: Ring[] = [];
	const sparks: Spark[] = [];
	const flashes: Flash[] = [];
	let screenFlash = 0;
	let raf = 0;
	let prev = 0;

	function resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		vw = window.innerWidth;
		vh = window.innerHeight;
		canvas.width = Math.round(vw * dpr);
		canvas.height = Math.round(vh * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	function isFull(): boolean {
		return mode === "full" && !prefersReducedMotion();
	}

	function trace(points: [number, number][]) {
		ctx.beginPath();
		ctx.moveTo(points[0][0], points[0][1]);
		for (let i = 1; i < points.length; i++)
			ctx.lineTo(points[i][0], points[i][1]);
	}

	function drawBolt(points: [number, number][], width: number, alpha: number) {
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		trace(points);
		const glow = options.glow;
		if (glow > 0) {
			ctx.strokeStyle = rgba(boltColor, 0.13 * alpha * glow);
			ctx.lineWidth = width * 7;
			ctx.stroke();
			ctx.strokeStyle = rgba(boltColor, Math.min(1, 0.5 * alpha * glow));
			ctx.lineWidth = width * 3.2;
			ctx.stroke();
		}
		ctx.strokeStyle = rgba(boltColor, 0.75 * alpha);
		ctx.lineWidth = width * 1.6;
		ctx.stroke();
		ctx.strokeStyle = rgba(coreColor, alpha);
		ctx.lineWidth = width;
		ctx.stroke();
	}

	function addBolt(
		x: number,
		y: number,
		angle: number,
		len: number,
		width: number,
		life: number,
		depth: number,
	) {
		if (bolts.length >= MAX_BOLTS) return;
		bolts.push({
			x,
			y,
			angle,
			len,
			width,
			life,
			depth,
			age: 0,
			pts: null,
			nextRegen: 0,
		});
	}

	function emitRing(x: number, y: number, life: number, radius: number) {
		rings.push({ x, y, age: 0, life, r1: radius });
	}

	function emitSparks(x: number, y: number) {
		const count = 10 + Math.round(Math.random() * 5);
		const speedScale = Math.sqrt(options.scale);
		for (let i = 0; i < count; i++) {
			const angle = Math.random() * Math.PI * 2;
			const speed = (1.4 + Math.random() * 3.1) * speedScale;
			sparks.push({
				x,
				y,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed - 0.4,
				age: 0,
				life: 380 + Math.random() * 380,
				size: 1.3 + Math.random() * 2.1,
			});
		}
	}

	function burst(cx: number, cy: number) {
		const scale = options.scale;

		if (!isFull()) {
			// 减弱模式：只留一圈快速扩散的光环，作为点击反馈
			emitRing(cx, cy, 260, 44 * scale);
			ensureLoop();
			return;
		}

		const life = options.duration;

		// 主干：1–2 条较粗的放电，形成从点击点炸开的主视觉
		const mainCount = Math.random() < 0.35 ? 2 : 1;
		for (let i = 0; i < mainCount; i++) {
			addBolt(
				cx,
				cy,
				Math.random() * Math.PI * 2,
				(95 + Math.random() * 55) * scale,
				2.4,
				life * (0.85 + Math.random() * 0.3),
				4,
			);
		}

		// 辐射分支：均匀分布 + 抖动，形成“炸开”的形态
		const count = options.bolts;
		const slot = (Math.PI * 2) / count;
		for (let i = 0; i < count; i++) {
			const angle = slot * i + (Math.random() - 0.5) * slot * 0.8;
			const len = (42 + Math.random() * 72) * scale;
			addBolt(cx, cy, angle, len, 1.6, life * (0.55 + Math.random() * 0.45), 3);

			// 分叉：从主干 55%–80% 处再劈出一道短弧
			if (Math.random() < 0.6) {
				const at = 0.55 + Math.random() * 0.25;
				const forkAngle =
					angle + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
				addBolt(
					cx + Math.cos(angle) * len * at,
					cy + Math.sin(angle) * len * at,
					forkAngle,
					len * (0.28 + Math.random() * 0.25),
					1.1,
					life * (0.4 + Math.random() * 0.3),
					2,
				);
			}
		}

		emitRing(cx, cy, life * 1.15, 74 * scale);
		flashes.push({ x: cx, y: cy, age: 0, life: 170, r1: 78 * scale });

		if (options.sparks) emitSparks(cx, cy);
		if (options.screenFlash) screenFlash = 1;

		ensureLoop();
	}

	function ensureLoop() {
		if (!raf) {
			prev = performance.now();
			raf = requestAnimationFrame(tick);
		}
	}

	function tick(now: number) {
		const dt = Math.min(now - prev, 48);
		prev = now;
		const k = dt / 16.67;

		ctx.clearRect(0, 0, vw, vh);

		for (let i = bolts.length - 1; i >= 0; i--) {
			const bolt = bolts[i];
			bolt.age += dt;
			const t = bolt.age / bolt.life;
			if (t >= 1) {
				bolts.splice(i, 1);
				continue;
			}
			// 每 ~45ms 重新抖动折线，产生电弧闪烁感
			if (!bolt.pts || bolt.age >= bolt.nextRegen) {
				const ex = bolt.x + Math.cos(bolt.angle) * bolt.len;
				const ey = bolt.y + Math.sin(bolt.angle) * bolt.len;
				bolt.pts = jagged(bolt.x, bolt.y, ex, ey, bolt.depth, bolt.len * 0.24);
				bolt.nextRegen = bolt.age + 45;
			}
			if (bolt.pts) drawBolt(bolt.pts, bolt.width, 1 - t);
		}

		for (let i = rings.length - 1; i >= 0; i--) {
			const ring = rings[i];
			ring.age += dt;
			const t = ring.age / ring.life;
			if (t >= 1) {
				rings.splice(i, 1);
				continue;
			}
			const progress = 1 - (1 - t) ** 2;
			ctx.beginPath();
			ctx.arc(
				ring.x,
				ring.y,
				RING_MIN_RADIUS + (ring.r1 - RING_MIN_RADIUS) * progress,
				0,
				Math.PI * 2,
			);
			ctx.strokeStyle = rgba(boltColor, 0.75 * (1 - t));
			ctx.lineWidth = 3 * (1 - t) + 0.5;
			ctx.stroke();
		}

		for (let i = flashes.length - 1; i >= 0; i--) {
			const flash = flashes[i];
			flash.age += dt;
			const t = flash.age / flash.life;
			if (t >= 1) {
				flashes.splice(i, 1);
				continue;
			}
			const radius = flash.r1 * (0.35 + 0.65 * (1 - (1 - t) ** 2));
			const gradient = ctx.createRadialGradient(
				flash.x,
				flash.y,
				0,
				flash.x,
				flash.y,
				radius,
			);
			gradient.addColorStop(0, rgba(coreColor, 0.6 * (1 - t)));
			gradient.addColorStop(0.45, rgba(boltColor, 0.26 * (1 - t)));
			gradient.addColorStop(1, rgba(boltColor, 0));
			ctx.fillStyle = gradient;
			ctx.beginPath();
			ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
			ctx.fill();
		}

		for (let i = sparks.length - 1; i >= 0; i--) {
			const spark = sparks[i];
			spark.age += dt;
			const t = spark.age / spark.life;
			if (t >= 1) {
				sparks.splice(i, 1);
				continue;
			}
			spark.vy += 0.12 * k;
			spark.vx *= 0.97;
			spark.vy *= 0.97;
			spark.x += spark.vx * k;
			spark.y += spark.vy * k;
			ctx.beginPath();
			ctx.arc(spark.x, spark.y, spark.size * (1 - t * 0.5), 0, Math.PI * 2);
			ctx.fillStyle = rgba(sparkColor, 0.9 * (1 - t));
			ctx.fill();
		}

		if (screenFlash > 0) {
			screenFlash = Math.max(0, screenFlash - dt / 110);
			ctx.fillStyle = rgba(coreColor, 0.055 * screenFlash);
			ctx.fillRect(0, 0, vw, vh);
		}

		const busy =
			bolts.length > 0 ||
			rings.length > 0 ||
			flashes.length > 0 ||
			sparks.length > 0 ||
			screenFlash > 0;
		raf = busy ? requestAnimationFrame(tick) : 0;
	}

	function onPointerDown(event: PointerEvent) {
		if (event.button !== 0) return;
		if (
			event.pointerType &&
			event.pointerType !== "mouse" &&
			event.pointerType !== "pen"
		)
			return;
		if (event.target instanceof Element && event.target.closest("[data-no-fx]"))
			return;
		burst(event.clientX, event.clientY);
	}

	resize();
	window.addEventListener("resize", resize);
	document.addEventListener("pointerdown", onPointerDown, { passive: true });

	return {
		setMode(next: ClickLightningMode) {
			mode = next;
		},
		destroy() {
			window.removeEventListener("resize", resize);
			document.removeEventListener("pointerdown", onPointerDown);
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
			canvas.remove();
		},
	};
}
