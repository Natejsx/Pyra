import { useState, useEffect, useCallback } from "react";

// ─── Location ────────────────────────────────────────────────────────────────

export interface Location {
  pathname: string;
  search: string;
  hash: string;
  searchParams: URLSearchParams;
}

function getLocation(): Location {
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
type SetSearchParams = (
  next: URLSearchParams | Record<string, string>
) => void;

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
      next instanceof URLSearchParams ? next : new URLSearchParams(next as Record<string, string>);
    const qs = params.toString();
    const url = window.location.pathname + (qs ? "?" + qs : "");
    history.pushState(null, "", url);
    window.dispatchEvent(new Event("pyra:urlchange"));
  }, []);

  return [searchParams, setSearchParams];
}

// useParams
function getParams(): Record<string, string> {
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
