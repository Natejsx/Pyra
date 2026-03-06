import { useState, useEffect, useCallback } from "react";

// ─── Location ────────────────────────────────────────────────────────────────

export interface Location {
  pathname: string;
  search: string;
  hash: string;
  searchParams: URLSearchParams;
}

const SSR_LOCATION: Location = {
  pathname: "/",
  search: "",
  hash: "",
  searchParams: new URLSearchParams(),
};

function getLocation(): Location {
  if (typeof window === "undefined") return SSR_LOCATION;
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    searchParams: new URLSearchParams(window.location.search),
  };
}

/**
 * Returns the current URL location and re-renders whenever it changes.
 * Updates on `<Link>` navigations, browser Back/Forward, and
 * `setSearchParams()` calls.
 */
export function useLocation(): Location {
  const [location, setLocation] = useState(getLocation);

  useEffect(() => {
    const handler = () => setLocation(getLocation());
    window.addEventListener("popstate", handler);
    window.addEventListener("pyra:navigate", handler);
    window.addEventListener("pyra:urlchange", handler);
    return () => {
      window.removeEventListener("popstate", handler);
      window.removeEventListener("pyra:navigate", handler);
      window.removeEventListener("pyra:urlchange", handler);
    };
  }, []);

  return location;
}

// useNavigate

/**
 * Returns a `navigate(href)` function for programmatic client-side navigation.
 * Equivalent to calling `window.__pyra.navigate(href)` but typed and safe to
 * use in components — no window access required.
 *
 * @example
 * const navigate = useNavigate();
 * async function handleSubmit() {
 *   await savePost(data);
 *   navigate("/dashboard");
 * }
 */
export function useNavigate(): (href: string) => void {
  return useCallback((href: string) => {
    const nav = (window as any).__pyra?.navigate;
    if (nav) {
      nav(href);
    } else {
      window.location.href = href;
    }
  }, []);
}

// useSearchParams
type SetSearchParams = (next: URLSearchParams | Record<string, string>) => void;

/**
 * Returns the current URL query string as a `URLSearchParams` object and a
 * setter that updates the URL without triggering a full page navigation.
 * The component re-renders whenever the search params change.
 *
 * @example
 * const [params, setParams] = useSearchParams();
 * const query = params.get("q") ?? "";
 *
 * function handleSearch(q: string) {
 *   setParams({ q, page: "1" });
 * }
 */
export function useSearchParams(): [URLSearchParams, SetSearchParams] {
  const { searchParams } = useLocation();

  const setSearchParams: SetSearchParams = useCallback((next) => {
    const params =
      next instanceof URLSearchParams
        ? next
        : new URLSearchParams(next as Record<string, string>);
    const qs = params.toString();
    const url = window.location.pathname + (qs ? "?" + qs : "");
    history.pushState(null, "", url);
    window.dispatchEvent(new Event("pyra:urlchange"));
  }, []);

  return [searchParams, setSearchParams];
}

// useParams
function getParams(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return (window as any).__pyra?.params ?? {};
}

/**
 * Returns the current route params (e.g. `{ slug: "hello-world" }`).
 * Useful for accessing params in deeply nested components without prop drilling.
 * Re-renders whenever navigation changes the active route.
 *
 * Note: params are also always available as a `params` prop on the page
 * component via `load()`. Use this hook when you need params deeper in the tree.
 *
 * @example
 * const { slug } = useParams();
 * return <h1>Post: {slug}</h1>;
 */
export function useParams(): Record<string, string> {
  const [params, setParams] = useState(getParams);

  useEffect(() => {
    const handler = () => setParams(getParams());
    window.addEventListener("pyra:navigate", handler);
    return () => window.removeEventListener("pyra:navigate", handler);
  }, []);

  return params;
}

// useNavigating
/**
 * Returns `true` while a client-side navigation is in progress (i.e. after
 * a `<Link>` click but before the new page component is rendered). Use this
 * to show a loading indicator or disable interactive elements during transitions.
 *
 * @example
 * const navigating = useNavigating();
 * return (
 *   <div>
 *     {navigating && <div className="progress-bar" />}
 *     <nav>...</nav>
 *   </div>
 * );
 */
export function useNavigating(): boolean {
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    const start = () => setNavigating(true);
    const end = () => setNavigating(false);
    window.addEventListener("pyra:navigate-start", start);
    window.addEventListener("pyra:navigate", end);
    window.addEventListener("pyra:navigate-error", end);
    return () => {
      window.removeEventListener("pyra:navigate-start", start);
      window.removeEventListener("pyra:navigate", end);
      window.removeEventListener("pyra:navigate-error", end);
    };
  }, []);

  return navigating;
}

// usePreload

/**
 * Returns a `preload(href)` function that fires a background fetch to warm up
 * the navigation data for a route before the user clicks. Attach it to
 * `onMouseEnter` or `onFocus` on any link to make subsequent navigation
 * feel instant — the browser caches the response automatically.
 *
 * @example
 * const preload = usePreload();
 * <Link href="/blog" onMouseEnter={() => preload("/blog")}>Blog</Link>
 */
export function usePreload(): (href: string) => void {
  return useCallback((href: string) => {
    try {
      const target = new URL(href, window.location.href);
      if (target.origin !== window.location.origin) return;
      fetch(
        "/_pyra/navigate?path=" +
          encodeURIComponent(target.pathname + target.search),
        { priority: "low" } as RequestInit,
      ).catch(() => {
        /* silently ignore preload failures */
      });
    } catch {
      // invalid URL — ignore
    }
  }, []);
}

// useBeforeNavigate

type NavigationGuard = (
  href: string,
) => boolean | string | Promise<boolean | string>;

/**
 * Registers a navigation guard that runs before every client-side navigation.
 * The guard receives the destination href and must return:
 * - `true` — allow navigation
 * - `false` — silently cancel navigation
 * - a string — show a `window.confirm()` dialog with that message; navigation
 *   proceeds only if the user confirms
 *
 * The guard is automatically removed when the component unmounts.
 *
 * @example
 * useBeforeNavigate((href) => {
 *   if (hasUnsavedChanges) {
 *     return "You have unsaved changes. Leave anyway?";
 *   }
 *   return true;
 * });
 */
export function useBeforeNavigate(guard: NavigationGuard): void {
  useEffect(() => {
    const guards: Set<NavigationGuard> = (window as any).__pyra?.guards;
    if (!guards) return;
    guards.add(guard);
    return () => {
      guards.delete(guard);
    };
  }, [guard]);
}

// useScrollRestoration

/**
 * Opts into scroll position restoration for Back/Forward navigation.
 * Call once in your root layout. Once active:
 * - Forward navigation scrolls to the top (same as default)
 * - Back/Forward navigation restores the scroll position from when you left
 *
 * Positions are stored in sessionStorage keyed by URL, so they survive
 * soft reloads within the same session.
 *
 * @example
 * // src/routes/layout.tsx
 * export default function Layout({ children }) {
 *   useScrollRestoration();
 *   return <div>{children}</div>;
 * }
 */
export function useScrollRestoration(): void {
  useEffect(() => {
    const pyra = (window as any).__pyra;
    if (pyra) pyra.disableAutoScroll = true;

    const saveScroll = () => {
      sessionStorage.setItem(
        "__pyra_scroll_" + window.location.href,
        String(window.scrollY),
      );
    };

    const restoreScroll = () => {
      const type = (window as any).__pyra?.navigationType;
      if (type === "pop") {
        const saved = sessionStorage.getItem(
          "__pyra_scroll_" + window.location.href,
        );
        window.scrollTo(0, saved ? parseInt(saved, 10) : 0);
      } else {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener("pyra:navigate-start", saveScroll);
    window.addEventListener("pyra:navigate", restoreScroll);

    return () => {
      if ((window as any).__pyra)
        (window as any).__pyra.disableAutoScroll = false;
      window.removeEventListener("pyra:navigate-start", saveScroll);
      window.removeEventListener("pyra:navigate", restoreScroll);
    };
  }, []);
}

// useRouteError

export interface RouteError {
  message: string;
  stack?: string;
}

/**
 * Returns the error that caused the nearest `error.tsx` boundary to render.
 * Use this inside error boundary components as an alternative to reading the
 * `error` prop — useful when you need the error in a nested component without
 * prop drilling.
 *
 * Returns `null` when there is no active route error.
 *
 * @example
 * // src/routes/error.tsx
 * export default function ErrorPage() {
 *   const error = useRouteError();
 *   return <div>Something went wrong: {error?.message}</div>;
 * }
 */
export function useRouteError(): RouteError | null {
  if (typeof window === "undefined") return null;
  return (window as any).__pyra?.routeError ?? null;
}
