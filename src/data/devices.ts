/**
 * 个人设备展示页数据源
 * 行为与分类规则由 config/devices.yaml 控制
 */

export type DeviceStatus = "active" | "backup" | "archived" | "wishlist";

export interface DeviceSpecItem {
	key: string;
	label: string;
	value: string;
}

export interface DeviceItem {
	enable?: boolean;
	id: string;
	name: string;
	brand: string;
	category: string;
	status: DeviceStatus;
	specs: string;
	specDetails?: DeviceSpecItem[];
	description: string;
	image?: string;
	icon?: string;
	link?: string;
	featured?: boolean;
	year?: string;
}

export const devicesData: DeviceItem[] = [
	{
		id: "iqoo-11s",
		name: "iQOO 11S",
		brand: "iQOO",
		category: "mobile",
		status: "active",
		specs: "黑色 · 16GB + 512GB",
		description: "高中时期入手的日常主力机。",
		icon: "material-symbols:smartphone",
		year: "2024",
	},
	{
		id: "honor-magicpad-3",
		name: "MagicPad 3",
		brand: "荣耀",
		category: "mobile",
		status: "active",
		specs: "灰色 · 16GB + 512GB",
		description: "日常影音娱乐与手写记录使用的平板。",
		icon: "material-symbols:tablet-rounded",
		year: "2025",
	},
	{
		id: "honor-magic-pencil-3",
		name: "Magic-Pencil 3",
		brand: "荣耀",
		category: "peripheral",
		status: "active",
		specs: "白色",
		description: "搭配 MagicPad 3 使用的手写笔。",
		icon: "material-symbols:stylus-rounded",
		year: "2025",
	},
	{
		id: "mechrevo-yaoshi-16-ultra",
		name: "耀世 16 Ultra",
		brand: "机械革命",
		category: "desk",
		status: "active",
		specs: "RTX 5070 Ti · 32GB · 1T + 2T",
		description: "大学时的主力开发与游戏本。",
		icon: "material-symbols:laptop-windows",
		featured: true,
		year: "2025",
	},
	{
		id: "titan-army-p275mv-plus",
		name: "P275MV PLUS",
		brand: "泰坦军团",
		category: "desk",
		status: "active",
		specs: "27 英寸 · 4K 160Hz / FHD 320Hz",
		specDetails: [
			{ key: "size", label: "尺寸", value: "27 英寸 · 16:9" },
			{
				key: "backlight",
				label: "背光",
				value: "QD-MiniLED · 1152 独立控光分区",
			},
			{
				key: "resolution",
				label: "分辨率",
				value: "4K（3840×2160）@160Hz / FHD（1080P）@320Hz 双模切换",
			},
		],
		description: "支持 4K 高画质与 FHD 高刷双模切换的桌面显示器。",
		icon: "material-symbols:monitor-rounded",
		year: "2026",
	},
	{
		id: "atk68rx",
		name: "ATK68RX",
		brand: "ATK",
		category: "peripheral",
		status: "active",
		specs: "白色 · 混元轴",
		description: "日常码字与游戏使用的机械键盘。",
		icon: "material-symbols:keyboard-rounded",
		year: "2025",
	},
	{
		id: "betop-kunpeng-40",
		name: "鲲鹏 40",
		brand: "北通",
		category: "peripheral",
		status: "active",
		specs: "游戏手柄",
		description: "日常游戏使用的手柄。",
		icon: "material-symbols:sports-esports-rounded",
		year: "2025",
	},
	{
		id: "xbox-wireless-controller-dream-vapor",
		name: "Xbox 无线控制器 · 精灵秘语",
		brand: "微软",
		category: "peripheral",
		status: "active",
		specs: "游戏手柄",
		description: "为《地平线 6》单独购置的手柄。",
		icon: "material-symbols:sports-esports-rounded",
		year: "2026",
	},
	{
		id: "simgot-ep5",
		name: "EP5",
		brand: "兴戈",
		category: "audio",
		status: "active",
		specs: "头戴式耳机",
		description: "搭配电脑日常听歌游戏使用的头戴式耳机。",
		icon: "material-symbols:headphones-rounded",
		year: "2025",
	},
	{
		id: "vivo-tws-3-pro",
		name: "TWS 3 Pro",
		brand: "vivo",
		category: "audio",
		status: "active",
		specs: "真无线降噪耳机",
		description: "日常通勤使用的真无线耳机。",
		icon: "material-symbols:earbuds-2-rounded",
		year: "2024",
	},
];
