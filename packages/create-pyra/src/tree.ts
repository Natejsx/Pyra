import pc from "picocolors";

// ── File Tree Formatter ──────────────────────────────────────────────
// Turns a flat list of relative paths into an indented tree display.
// Root files first (sorted), then directories (sorted), recursively.

interface DirNode {
  files: string[];
  subdirs: Map<string, DirNode>;
}

function buildTree(paths: string[]): DirNode {
  const root: DirNode = { files: [], subdirs: new Map() };

  for (const p of paths) {
    const parts = p.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      if (i === parts.length - 1) {
        current.files.push(parts[i]);
      } else {
        if (!current.subdirs.has(parts[i])) {
          current.subdirs.set(parts[i], { files: [], subdirs: new Map() });
        }
        current = current.subdirs.get(parts[i])!;
      }
    }
  }

  return root;
}

function render(node: DirNode, indent: string): string[] {
  const lines: string[] = [];

  // Files first (sorted)
  for (const file of [...node.files].sort()) {
    lines.push(`${indent}${pc.dim(file)}`);
  }

  // Directories (sorted)
  const dirs = [...node.subdirs.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  for (const [name, child] of dirs) {
    lines.push(`${indent}${pc.cyan(name + "/")}`);
    lines.push(...render(child, indent + "  "));
  }

  return lines;
}

/**
 * Format flat file paths into an indented tree string.
 *
 * Example output:
 *   .gitignore
 *   package.json
 *   pyra.config.ts
 *   src/
 *     routes/
 *       page.tsx
 *       layout.tsx
 */
export function formatFileTree(paths: string[]): string {
  const tree = buildTree(paths);
  return render(tree, "  ").join("\n");
}
