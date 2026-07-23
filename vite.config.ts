import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

function webdavProxyPlugin(): Plugin {
  return {
    name: "webdav-proxy",
    configureServer(server) {
      server.middlewares.use("/api/proxy", async (req, res) => {
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const target = url.searchParams.get("url");
        if (!target) {
          res.statusCode = 400;
          res.end("Missing url param");
          return;
        }

        try {
          const headers: Record<string, string> = {};
          if (req.headers.authorization) {
            headers.Authorization = req.headers.authorization;
          }
          if (req.headers["content-type"]) {
            headers["Content-Type"] = req.headers["content-type"];
          }

          let body: string | undefined;
          if (req.method === "PUT") {
            body = await readBody(req);
          }

          const fetchRes = await fetch(target, {
            method: req.method,
            headers,
            body,
          });

          res.statusCode = fetchRes.status;
          fetchRes.headers.forEach((v, k) => {
            if (k !== "transfer-encoding") res.setHeader(k, v);
          });

          const resBody = await fetchRes.arrayBuffer();
          res.end(Buffer.from(resBody));
        } catch (e: any) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    },
  };
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
  });
}

export default defineConfig({
  plugins: [
    react(),
    webdavProxyPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
      ],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "external-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
      manifest: {
        id: "quiz-master-app",
        name: "Quiz Master - 智能答题复习",
        short_name: "QuizMaster",
        description: "跨平台智能答题复习系统，支持MD/JSON/CSV/Excel题库导入",
        theme_color: "#6366f1",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        lang: "zh-CN",
        categories: ["education", "productivity"],
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
});
