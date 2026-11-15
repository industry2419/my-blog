/**
 * 大事记时间线数据源
 * 用于 /timeline/ 页面展示
 */

export interface TimelineLink {
	label: string;
	url: string;
	icon?: string;
}

export interface TimelineItem {
	enable?: boolean;
	title: string;
	date: string;
	category?: string;
	subtitle?: string;
	location?: string;
	description?: string;
	highlights?: string[];
	tags?: string[];
	links?: TimelineLink[];
	icon?: string;
	featured?: boolean;
}

export const timelineData: TimelineItem[] = [
	{
		title: "个人博客上线",
		date: "2026.11",
		category: "milestone",
		subtitle: "建站",
		description: "从 Shirone 主题开始搭建个人博客。",
		icon: "material-symbols:rocket-launch-rounded",
		featured: true,
	},
];
