import pc from "picocolors";

// Color Palette
// Consistent across the entire wizard. Accent = cyan, brand = red.

export const S = {
  // Brand
  brand: (s: string) => pc.red(s),
  brandBold: (s: string) => pc.bold(pc.red(s)),

  // Accent (primary interactive color)
  accent: (s: string) => pc.cyan(s),
  accentBold: (s: string) => pc.bold(pc.cyan(s)),

  // Status
  success: (s: string) => pc.green(s),
  successBold: (s: string) => pc.bold(pc.green(s)),
  warn: (s: string) => pc.yellow(s),
  error: (s: string) => pc.red(s),

  // Text
  dim: (s: string) => pc.dim(s),
  bold: (s: string) => pc.bold(s),
};

// Helpers

/**
 * Format step progress indicator.
 * e.g. "Step 2/6 · Framework"
 */
export function stepLabel(
  current: number,
  total: number,
  name: string,
): string {
  return `${S.dim(`Step ${current}/${total}`)} ${S.dim("·")} ${name}`;
}

/**
 * Build a padded summary row: "  Label        Value"
 */
export function summaryRow(
  label: string,
  value: string,
  width = 14,
): string {
  return `  ${S.dim(label.padEnd(width))} ${S.bold(value)}`;
}
