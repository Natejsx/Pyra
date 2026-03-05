/**
 * Browser-safe entry point for @pyra-js/adapter-react.
 *
 * Exports only the React components and hooks that are safe to bundle for the
 * browser. Intentionally excludes `createReactAdapter` (and by extension
 * `fast-refresh-plugin`) because those modules import Node.js built-ins
 * (path, fs, module) that cannot be resolved in a browser bundle.
 *
 * esbuild picks this file automatically when `platform: "browser"` is set,
 * via the "browser" condition in the package.json "exports" field.
 */
export { Image } from "./Image.js";
export type { ImageProps } from "./Image.js";
export { Link } from "./Link.js";
export { NavLink } from "./NavLink.js";
export type { NavLinkProps } from "./NavLink.js";
export { Head } from "./Head.js";
export type { HeadProps } from "./Head.js";
export { ClientOnly } from "./ClientOnly.js";
export type { ClientOnlyProps } from "./ClientOnly.js";
export { Form } from "./Form.js";
export type { FormProps } from "./Form.js";
export {
  useLocation,
  useNavigate,
  useSearchParams,
  useParams,
  useNavigating,
  usePreload,
  useBeforeNavigate,
  useScrollRestoration,
  useRouteError,
} from "./hooks.js";
export type { Location, RouteError } from "./hooks.js";
