import { createElement } from "react";
import type { CSSProperties, AnchorHTMLAttributes } from "react";
import { Link } from "./Link.js";
import { useLocation } from "./hooks.js";

export interface NavLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /**
   * Class applied when this link's href matches the current URL.
   * Defaults to "active".
   */
  activeClassName?: string;
  /**
   * Inline styles applied when this link's href matches the current URL.
   */
  activeStyle?: CSSProperties;
  /**
   * When true, only marks active on an exact pathname match.
   * When false (default), marks active when the pathname starts with href —
   * so `/blog` is active on `/blog/hello-world`.
   */
  exact?: boolean;
}

/**
 * A `<Link>` that automatically applies an active class when its href matches
 * the current URL. Use this in navbars and menus instead of `<Link>` to avoid
 * manually comparing `pathname` in every component.
 *
 * @example
 * <NavLink href="/blog">Blog</NavLink>
 * // renders <a class="active"> when on /blog or /blog/any-post
 *
 * @example
 * <NavLink href="/" exact>Home</NavLink>
 * // only active on exactly /
 */
export function NavLink({
  href,
  activeClassName = "active",
  activeStyle,
  exact = false,
  className,
  style,
  children,
  ...props
}: NavLinkProps) {
  const { pathname } = useLocation();

  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  const resolvedClassName = isActive
    ? [className, activeClassName].filter(Boolean).join(" ")
    : className;

  const resolvedStyle =
    isActive && activeStyle ? { ...style, ...activeStyle } : style;

  return createElement(
    Link,
    { href, className: resolvedClassName, style: resolvedStyle, ...props },
    children,
  );
}
