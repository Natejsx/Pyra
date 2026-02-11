// src/routes/page.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function Home() {
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { children: "Welcome to Pyra" }),
    /* @__PURE__ */ jsx("p", { children: "This page was server-side rendered and hydrated on the client." }),
    /* @__PURE__ */ jsxs("nav", { children: [
      /* @__PURE__ */ jsx("a", { href: "/about", children: "About" }),
      " | ",
      /* @__PURE__ */ jsx("a", { href: "/blog/hello-world", children: "Blog Post" })
    ] }),
    /* @__PURE__ */ jsx("button", { onClick: () => alert("Hydration works!"), children: "Click me" })
  ] });
}
export {
  Home as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3JjL3JvdXRlcy9wYWdlLnRzeCJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gSG9tZSgpIHtcclxuICByZXR1cm4gKFxyXG4gICAgPGRpdj5cclxuICAgICAgPGgxPldlbGNvbWUgdG8gUHlyYTwvaDE+XHJcbiAgICAgIDxwPlRoaXMgcGFnZSB3YXMgc2VydmVyLXNpZGUgcmVuZGVyZWQgYW5kIGh5ZHJhdGVkIG9uIHRoZSBjbGllbnQuPC9wPlxyXG4gICAgICA8bmF2PlxyXG4gICAgICAgIDxhIGhyZWY9XCIvYWJvdXRcIj5BYm91dDwvYT4gfCA8YSBocmVmPVwiL2Jsb2cvaGVsbG8td29ybGRcIj5CbG9nIFBvc3Q8L2E+XHJcbiAgICAgIDwvbmF2PlxyXG4gICAgICA8YnV0dG9uIG9uQ2xpY2s9eygpID0+IGFsZXJ0KFwiSHlkcmF0aW9uIHdvcmtzIVwiKX0+Q2xpY2sgbWU8L2J1dHRvbj5cclxuICAgIDwvZGl2PlxyXG4gICk7XHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUdNLGNBRUEsWUFGQTtBQUhTLFNBQVIsT0FBd0I7QUFDN0IsU0FDRSxxQkFBQyxTQUNDO0FBQUEsd0JBQUMsUUFBRyw2QkFBZTtBQUFBLElBQ25CLG9CQUFDLE9BQUUsNEVBQThEO0FBQUEsSUFDakUscUJBQUMsU0FDQztBQUFBLDBCQUFDLE9BQUUsTUFBSyxVQUFTLG1CQUFLO0FBQUEsTUFBSTtBQUFBLE1BQUcsb0JBQUMsT0FBRSxNQUFLLHFCQUFvQix1QkFBUztBQUFBLE9BQ3BFO0FBQUEsSUFDQSxvQkFBQyxZQUFPLFNBQVMsTUFBTSxNQUFNLGtCQUFrQixHQUFHLHNCQUFRO0FBQUEsS0FDNUQ7QUFFSjsiLAogICJuYW1lcyI6IFtdCn0K
