<script lang="ts">
/**
 * 点击闪电特效（皮卡丘放电风格）的持久壳层挂载点。
 * 只在 `clickEffectConfig.enable` 时渲染；关闭时组件不进入页面，
 * 不注册监听、不创建画布、不把运行时打进首包。特效实例全局唯一，
 * 访客在显示设置面板切换偏好时只更新模式，不重建画布。
 */
import { CLICK_EFFECT_CHANGE_EVENT } from "@constants/constants";
import {
	type ClickEffectPreference,
	getClickEffectPreference,
} from "@utils/setting-utils";
import { onMount } from "svelte";
import type { ResolvedClickEffectOptions } from "@/types/clickEffectConfig";
import { createClickLightning } from "./click-lightning";

let { options }: { options: ResolvedClickEffectOptions } = $props();

onMount(() => {
	const runtime = createClickLightning(options, getClickEffectPreference());
	const onPreferenceChange = (event: Event) => {
		const preference =
			(event as CustomEvent<{ preference?: ClickEffectPreference }>).detail
				?.preference ?? getClickEffectPreference();
		runtime.setMode(preference);
	};
	window.addEventListener(CLICK_EFFECT_CHANGE_EVENT, onPreferenceChange);
	return () => {
		window.removeEventListener(CLICK_EFFECT_CHANGE_EVENT, onPreferenceChange);
		runtime.destroy();
	};
});
</script>
