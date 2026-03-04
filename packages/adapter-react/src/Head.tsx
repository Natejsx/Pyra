import { useEffect } from "react";

export interface HeadProps {
  /** Sets document.title */
  title?: string;
  /** Updates or creates <meta name="description"> */
  description?: string;
  /** Updates or creates <meta property="og:title"> */
  ogTitle?: string;
  /** Updates or creates <meta property="og:description"> */
  ogDescription?: string;
  /** Updates or creates <meta property="og:image"> */
  ogImage?: string;
  /** Updates or creates <meta name="twitter:card"> */
  twitterCard?: "summary" | "summary_large_image" | "app" | "player";
}

function getMeta(selector: string): HTMLMetaElement | null {
  return document.querySelector<HTMLMetaElement>(selector);
}

function setMeta(selector: string, attr: string, value: string): () => void {
  let el = getMeta(selector);
  const existed = !!el;
  const previous = el?.getAttribute("content") ?? null;

  if (!el) {
    el = document.createElement("meta");
    const [attrName, attrValue] = attr.split("=");
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }

  el.setAttribute("content", value);

  return () => {
    const current = getMeta(selector);
    if (!current) return;
    if (!existed) {
      current.remove();
    } else if (previous !== null) {
      current.setAttribute("content", previous);
    }
  };
}

/**
 * Updates `<head>` tags from anywhere in the component tree.
 * Changes are applied on mount and restored on unmount, so navigating
 * away from a page cleans up its head tags automatically.
 *
 * @example
 * export default function BlogPost({ post }) {
 *   return (
 *     <>
 *       <Head
 *         title={post.title}
 *         description={post.excerpt}
 *         ogImage={post.coverImage}
 *       />
 *       <article>{post.body}</article>
 *     </>
 *   );
 * }
 */
export function Head({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  twitterCard,
}: HeadProps) {
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const previousTitle = document.title;

    if (title) {
      document.title = title;
      cleanups.push(() => { document.title = previousTitle; });
    }
    if (description) {
      cleanups.push(setMeta('meta[name="description"]', "name=description", description));
    }
    if (ogTitle) {
      cleanups.push(setMeta('meta[property="og:title"]', "property=og:title", ogTitle));
    }
    if (ogDescription) {
      cleanups.push(setMeta('meta[property="og:description"]', "property=og:description", ogDescription));
    }
    if (ogImage) {
      cleanups.push(setMeta('meta[property="og:image"]', "property=og:image", ogImage));
    }
    if (twitterCard) {
      cleanups.push(setMeta('meta[name="twitter:card"]', "name=twitter:card", twitterCard));
    }

    return () => cleanups.forEach((fn) => fn());
  }, [title, description, ogTitle, ogDescription, ogImage, twitterCard]);

  return null;
}
