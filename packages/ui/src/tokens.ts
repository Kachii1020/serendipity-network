export type ColorPair = {
  background: `#${string}`;
  foreground: `#${string}`;
  contrast: number;
};

export const providerIdentityTokens = {
  kiln: {
    background: "#55DB9C",
    foreground: "#000000",
    contrast: 12,
  },
  nori: {
    background: "#FFD731",
    foreground: "#000000",
    contrast: 15.02,
  },
  loop: {
    background: "#FB8050",
    foreground: "#000000",
    contrast: 8.31,
  },
} as const satisfies Record<string, ColorPair>;

export const designTokens = {
  canvas: "#DCEEFF",
  paper: "#FFFFFF",
  ink: "#000000",
  outline: "#000000",
  action: "#5C4ADE",
  actionInk: "#FFFFFF",
  softLavender: "#E9CCFF",
  focus: "#5C4ADE",
  controlMinHeight: 52,
  primaryMinHeight: 60,
  focusRingWidth: 3,
  focusRingOffset: 2,
  radiusCard: 28,
  radiusPill: 999,
  status: {
    neutral: { background: "#FFFFFF", foreground: "#000000" },
    working: { background: "#E9CCFF", foreground: "#000000" },
    success: { background: "#C8F4DC", foreground: "#000000" },
    warning: { background: "#FFF0A8", foreground: "#000000" },
    danger: { background: "#FFD2D2", foreground: "#000000" },
    unknown: { background: "#E6E6E6", foreground: "#000000" },
  },
} as const;

const normalizeHex = (value: string): [number, number, number] => {
  const hex = value.replace(/^#/, "");
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    throw new TypeError(
      `Expected a 3- or 6-digit hex color, received ${value}`,
    );
  }
  return [0, 2, 4].map((offset) =>
    Number.parseInt(expanded.slice(offset, offset + 2), 16),
  ) as [number, number, number];
};

const relativeLuminance = (color: string): number => {
  const toLinear = (channel: number): number => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const channels = normalizeHex(color);
  const red = toLinear(channels[0]);
  const green = toLinear(channels[1]);
  const blue = toLinear(channels[2]);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
};

export const getContrastRatio = (
  foreground: string,
  background: string,
): number => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
};
