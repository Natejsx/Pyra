import type { PyraPlugin } from "@pyra-js/shared";

/**
 * `pyraFramerMotion()` — Pyra plugin for Framer Motion + SSR compatibility.
 *
 * **Problem:** Framer Motion bakes `initial` prop values as inline styles into
 * SSR HTML. For `whileInView` animations (no `animate` prop), Framer Motion
 * renders the `initial` state on the server — e.g. `opacity: 0` — leaving
 * content invisible until the IntersectionObserver fires client-side. With
 * React 19 + Framer Motion v12 this observer can be unreliable on first load.
 *
 * **Solution:** This plugin injects a `<style>` tag into every SSR page's
 * `<head>` that overrides all Framer Motion elements (`[data-projection-id]`)
 * to be fully visible (`opacity: 1`, `transform: none`). After React hydrates,
 * wrap your root layout with `<FramerMotionReady>` from
 * `@pyra-js/adapter-react` — it removes the override style, handing control
 * back to Framer Motion's own animation system.
 *
 * @example
 * ```ts
 * // pyra.config.ts
 * import { pyraFramerMotion } from '@pyra-js/core';
 * export default defineConfig({
 *   plugins: [pyraFramerMotion()],
 * });
 * ```
 *
 * ```tsx
 * // src/routes/layout.tsx
 * import { FramerMotionReady } from '@pyra-js/adapter-react';
 * export default function Layout({ children }) {
 *   return <FramerMotionReady>{children}</FramerMotionReady>;
 * }
 * ```
 */
export function pyraFramerMotion(): PyraPlugin {
  return {
    name: "pyra:framer-motion",
    headInjection() {
      return `<style id="__pyra_fm">[data-projection-id]{opacity:1!important;transform:none!important}</style>`;
    },
  };
}
