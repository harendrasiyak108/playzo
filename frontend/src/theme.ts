export const colors = {
  surface: "#0F0F11",
  surfaceSecondary: "#18181C",
  surfaceTertiary: "#222228",
  onSurface: "#F4F4F5",
  onSurfaceSecondary: "#D4D4D8",
  onSurfaceTertiary: "#A1A1AA",
  brand: "#CCFF00",
  onBrand: "#050505",
  brandSecondary: "#FF2A55",
  success: "#00FF66",
  warning: "#FFB800",
  error: "#FF2A55",
  info: "#00E5FF",
  border: "#272730",
  borderStrong: "#3F3F4E",
  divider: "#1F1F24",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

// Use system fonts with heavy tracking/weight for the gaming vibe.
export const fonts = {
  display: undefined as string | undefined, // system, with letterSpacing on styles
  text: undefined as string | undefined,
};

export const statusColor = (status: string) => {
  switch (status) {
    case "available":
      return colors.success;
    case "occupied":
      return colors.brandSecondary;
    case "maintenance":
      return colors.warning;
    default:
      return colors.onSurfaceTertiary;
  }
};

export const stationTypeIcon = (type: string) => {
  switch (type) {
    case "pc":
      return "🖥️";
    case "console":
      return "🎮";
    case "table":
      return "🎱";
    default:
      return "🕹️";
  }
};
