import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Todori",
  description: "Claude Code-native task management MCP server with minimal context overhead",
  base: "/todori/",

  locales: {
    root: {
      label: "English",
      lang: "en",
      themeConfig: {
        nav: [
          { text: "Home", link: "/" },
          { text: "Guide", link: "/guide/installation" },
          { text: "API", link: "/api/reference" },
        ],

        sidebar: {
          "/guide/": [
            {
              text: "Getting Started",
              items: [
                { text: "Installation", link: "/guide/installation" },
                { text: "Usage", link: "/guide/usage" },
              ],
            },
          ],
          "/api/": [
            {
              text: "API Reference",
              items: [{ text: "MCP Tools", link: "/api/reference" }],
            },
          ],
        },
      },
    },
    ja: {
      label: "日本語",
      lang: "ja",
      themeConfig: {
        nav: [
          { text: "ホーム", link: "/ja/" },
          { text: "ガイド", link: "/ja/guide/installation" },
          { text: "API", link: "/ja/api/reference" },
        ],

        sidebar: {
          "/ja/guide/": [
            {
              text: "はじめに",
              items: [
                { text: "インストール", link: "/ja/guide/installation" },
                { text: "使い方", link: "/ja/guide/usage" },
              ],
            },
          ],
          "/ja/api/": [
            {
              text: "APIリファレンス",
              items: [{ text: "MCPツール", link: "/ja/api/reference" }],
            },
          ],
        },

        outline: {
          label: "目次",
        },

        docFooter: {
          prev: "前のページ",
          next: "次のページ",
        },

        lastUpdated: {
          text: "最終更新",
        },
      },
    },
  },

  themeConfig: {
    socialLinks: [{ icon: "github", link: "https://github.com/litols/todori" }],
  },
});
