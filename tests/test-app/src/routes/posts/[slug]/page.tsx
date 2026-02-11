// Dynamic prerendered page — prerenders 3 slugs at build time
import type { RequestContext } from "pyrajs-shared";

export const prerender = {
  paths() {
    return [
      { slug: "hello" },
      { slug: "world" },
      { slug: "foo" },
    ];
  },
};

export async function load(ctx: RequestContext) {
  return {
    title: `Post: ${ctx.params.slug}`,
    slug: ctx.params.slug,
  };
}

export default function Post(props: { title: string; slug: string; params: Record<string, string> }) {
  return (
    <div>
      <h1>{props.title}</h1>
      <p>You are reading post: {props.slug}</p>
    </div>
  );
}
