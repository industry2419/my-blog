/**
 * 技能图谱数据源
 * 用于 /skills/ 页面展示
 */

export type SkillLevel =
	| "beginner"
	| "intermediate"
	| "advanced"
	| "proficient"
	| "expert"
	| "master";

export interface SkillItem {
	enable?: boolean;
	name: string;
	description?: string;
	icon?: string;
	category: string;
	level: SkillLevel;
}

export const skillsData: SkillItem[] = [
	{
		name: "HTML",
		description: "语义化结构与可访问性标记的日常书写。",
		icon: "simple-icons:html5",
		category: "frontend",
		level: "beginner",
	},
	{
		name: "CSS",
		description: "响应式布局、设计令牌与现代 CSS 特性实践。",
		icon: "simple-icons:css",
		category: "frontend",
		level: "beginner",
	},
	{
		name: "JavaScript",
		description: "浏览器端交互逻辑与现代模块化开发。",
		icon: "simple-icons:javascript",
		category: "frontend",
		level: "beginner",
	},
	{
		name: "C++",
		description: "面向对象与底层编程基础，用于算法与性能相关练习。",
		icon: "simple-icons:cplusplus",
		category: "backend",
		level: "intermediate",
	},
	{
		name: "Python",
		description: "脚本自动化、数据处理与工具链小工具编写。",
		icon: "simple-icons:python",
		category: "backend",
		level: "beginner",
	},
	{
		name: "Unity",
		description: "游戏原型搭建、场景与基础交互逻辑实现。",
		icon: "simple-icons:unity",
		category: "game",
		level: "beginner",
	},
];
