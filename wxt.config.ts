import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Save ChatGPT History",
    short_name: "ChatGPT Export",
    description:
      "Parse ChatGPT conversation JSON locally and export it as Markdown.",
    version: "0.1.0",
    permissions: ["storage", "downloads", "sidePanel"],
    action: {
      default_title: "Save ChatGPT History",
      default_popup: "popup.html",
    },
    side_panel: {
      default_path: "sidepanel.html",
    },
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
  },
});
