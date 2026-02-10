
import { hydrateRoot } from "react-dom/client";
import { createElement } from "react";
import Component from "../../../src/routes/blog/page.tsx";

const container = document.getElementById("app");
const dataEl = document.getElementById("__pyra_data");
const data = dataEl ? JSON.parse(dataEl.textContent || "{}") : {};
hydrateRoot(container, createElement(Component, data));
