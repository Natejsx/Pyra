# Framer Motion

Use Framer Motion with Pyra SSR without invisible content or broken entrance animations.

---

## The Problem

Framer Motion is a popular React animation library, but it has a fundamental incompatibility with server-side rendering that affects any SSR framework, not just Pyra.

When you write a component like this:

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  whileInView={{ opacity: 1, y: 0 }}
>
  Content
</motion.div>
```

Framer Motion renders the `initial` state into the SSR HTML as an inline style:

```html
<div data-projection-id="1" style="opacity: 0; transform: translateY(20px);">
  Content
</div>
```

For `animate`-based animations (where Framer Motion knows the target state at render time), the library renders the `animate` state on the server — so the HTML is correct. But for `whileInView` animations, there is no target state until the IntersectionObserver fires client-side. The server renders `initial`, and the content stays invisible until JavaScript hydrates, Framer Motion initializes, and the observer detects the element.

In practice this means:

- **Content is invisible on first load** if `initial` includes `opacity: 0`
- **Slow connections or heavy pages** leave users staring at blank sections
- **With React 19 + Framer Motion v12**, the IntersectionObserver can be unreliable enough that content never animates in at all

---

## The Fix: `pyraFramerMotion()`

Pyra provides a plugin that solves this at the framework level. It injects a small `<style>` tag into every SSR page that overrides Framer Motion's inline opacity and transform styles, keeping all animated elements visible during SSR and before hydration.

After React hydrates and Framer Motion initializes client-side, the override is removed — and Framer Motion's own animation system takes over normally.

---

## Setup

### 1. Add the plugin to your config

```ts
// pyra.config.ts
import { defineConfig, pyraFramerMotion } from '@pyra-js/cli';
import { createReactAdapter } from '@pyra-js/adapter-react';

export default defineConfig({
  adapter: createReactAdapter(),
  plugins: [pyraFramerMotion()],
});
```

### 2. Wrap your root layout with `<FramerMotionReady>`

```tsx
// src/routes/layout.tsx
import { FramerMotionReady } from '@pyra-js/adapter-react';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FramerMotionReady>
      {children}
    </FramerMotionReady>
  );
}
```

That's all the configuration needed. Your existing Framer Motion components work without any changes.

---

## How It Works

### The plugin

`pyraFramerMotion()` implements the `headInjection` plugin hook. On every SSR page render, Pyra calls `headInjection()` and prepends the result to `<head>` before the adapter's own tags. The plugin returns:

```html
<style id="__pyra_fm">[data-projection-id]{opacity:1!important;transform:none!important}</style>
```

Framer Motion adds a `data-projection-id` attribute to every `motion.*` element it renders. This selector targets all of them and overrides their inline styles — making them fully visible regardless of what `initial` specifies.

Because this style is in `<head>`, it applies before the browser paints anything. There is no flash of invisible content.

### `<FramerMotionReady>`

After React hydrates, `<FramerMotionReady>` removes the injected `<style>` tag:

```tsx
useEffect(() => {
  requestAnimationFrame(() => {
    const style = document.getElementById('__pyra_fm');
    if (style) style.remove();
  });
}, []);
```

The `requestAnimationFrame` delay is intentional. Framer Motion uses `useLayoutEffect` internally to set up its animation engine — by deferring to the next frame, the override isn't removed until Framer Motion has fully initialized and is ready to control the elements. Removing it too early would cause a visible jump from visible back to `initial` before Framer Motion can animate.

Once the style is removed, Framer Motion's `whileInView`, `animate`, and all other animation props work exactly as they do in a client-side-only app.

---

## What Still Works

With the plugin active, all Framer Motion features work normally:

- `whileInView` — triggers when the element enters the viewport
- `animate` — plays immediately after hydration
- `whileHover` / `whileTap` — interactive animations, unaffected
- `AnimatePresence` — enter/exit animations for conditional elements
- `useAnimation` / `useMotionValue` — programmatic control
- `layout` animations — automatic layout transitions

The only difference is that during SSR and the brief moment before `<FramerMotionReady>` fires, elements are visible instead of invisible. The animations themselves are unchanged.

---

## Avoiding Opacity in `initial`

Even with the plugin, it's worth understanding which `initial` values are safe vs. which ones cause the SSR problem in the first place.

**Safe — transforms only:**

```tsx
// Fine: y, x, scale don't hide content
<motion.div initial={{ y: 20 }} whileInView={{ y: 0 }}>
  Content
</motion.div>
```

**Problematic without the plugin — opacity:**

```tsx
// Without the plugin, this bakes opacity: 0 into SSR HTML
<motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}>
  Content
</motion.div>
```

The plugin fixes the opacity case automatically, but if you're building new components, preferring `y`/`scale`/`x` in `initial` over `opacity` keeps things simpler and avoids the dependency on the plugin's override entirely.

**Always safe — interactive-only animations:**

```tsx
// whileHover and whileTap never affect SSR
<motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
  Click me
</motion.button>
```

---

## Entrance Animations Without Framer Motion

For hero sections and other above-the-fold content that needs to animate in on page load, CSS animations are a simpler and more SSR-friendly alternative. They require no JavaScript to run, no hydration delay, and no IntersectionObserver.

```css
/* style.css */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: no-preference) {
  .hero-animate {
    opacity: 0;
    animation: fadeInUp 0.5s ease forwards;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-animate { opacity: 1; }
}
```

```tsx
export default function Hero() {
  return (
    <h1
      className="hero-animate"
      style={{ animationDelay: '0.2s' }}
    >
      Hello world
    </h1>
  );
}
```

CSS animations start before JavaScript loads, so there's never a blank frame. Use this approach for content that should animate immediately on page load, and Framer Motion for scroll-triggered or interactive animations where its capabilities shine.

---

## Tips

- **Put `<FramerMotionReady>` in your root layout.** It only needs to run once per page load. Nesting it inside a component that remounts will remove the style prematurely.
- **The plugin has no options.** It's a single `<style>` tag — nothing to configure.
- **Works in both dev and production.** The `headInjection` hook runs in the dev server and the production server.
- **No performance cost.** The injected `<style>` block is fewer than 100 bytes and is removed after hydration. It doesn't affect runtime animation performance.
- **Don't use `initial={{ opacity: 0 }}` in `animate`-based animations.** For `animate` (not `whileInView`), Framer Motion renders the `animate` state on the server, so the plugin override is irrelevant — but it still makes the code harder to reason about.
