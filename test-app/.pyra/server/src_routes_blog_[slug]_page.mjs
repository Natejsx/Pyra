// src/routes/blog/[slug]/page.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function BlogPost({ params }) {
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsxs("h1", { children: [
      "Blog: ",
      params.slug
    ] }),
    /* @__PURE__ */ jsxs("p", { children: [
      "You are reading the post with slug: ",
      /* @__PURE__ */ jsx("strong", { children: params.slug })
    ] }),
    /* @__PURE__ */ jsx("a", { href: "/", children: "Back to Home" })
  ] });
}
export {
  BlogPost as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL3JvdXRlcy9ibG9nL1tzbHVnXS9wYWdlLnRzeCJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gQmxvZ1Bvc3QoeyBwYXJhbXMgfTogeyBwYXJhbXM6IHsgc2x1Zzogc3RyaW5nIH0gfSkge1xyXG4gIHJldHVybiAoXHJcbiAgICA8ZGl2PlxyXG4gICAgICA8aDE+QmxvZzoge3BhcmFtcy5zbHVnfTwvaDE+XHJcbiAgICAgIDxwPllvdSBhcmUgcmVhZGluZyB0aGUgcG9zdCB3aXRoIHNsdWc6IDxzdHJvbmc+e3BhcmFtcy5zbHVnfTwvc3Ryb25nPjwvcD5cclxuICAgICAgPGEgaHJlZj1cIi9cIj5CYWNrIHRvIEhvbWU8L2E+XHJcbiAgICA8L2Rpdj5cclxuICApO1xyXG59XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFHTSxTQUN1QyxLQUR2QztBQUhTLFNBQVIsU0FBMEIsRUFBRSxPQUFPLEdBQWlDO0FBQ3pFLFNBQ0UscUJBQUMsU0FDQztBQUFBLHlCQUFDLFFBQUc7QUFBQTtBQUFBLE1BQU8sT0FBTztBQUFBLE9BQUs7QUFBQSxJQUN2QixxQkFBQyxPQUFFO0FBQUE7QUFBQSxNQUFvQyxvQkFBQyxZQUFRLGlCQUFPLE1BQUs7QUFBQSxPQUFTO0FBQUEsSUFDckUsb0JBQUMsT0FBRSxNQUFLLEtBQUksMEJBQVk7QUFBQSxLQUMxQjtBQUVKOyIsCiAgIm5hbWVzIjogW10KfQo=
