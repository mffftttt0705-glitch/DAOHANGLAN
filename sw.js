/* PWA SW v2：导航走网络优先，避免坏缓存导致 ERR_FAILED */
const CACHE = "nav-ai-v2";
const PRECACHE = [
  "/",
  "/style.css",
  "/script.js",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // 逐个预缓存，单个失败不拖垮整个 install
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url, { cache: "no-store" });
            if (res && res.ok) await cache.put(url, res);
          } catch (_) {}
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 只处理同源
  if (url.origin !== self.location.origin) return;
  // API 永不走 SW 缓存
  if (url.pathname.startsWith("/api/")) return;

  // HTML / 导航：网络优先，失败再回退缓存（避免缓存坏页）
  const isNav =
    req.mode === "navigate" ||
    (req.headers.get("accept") || "").includes("text/html") ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html");

  if (isNav) {
    event.respondWith(
      (async () => {
        try {
          const net = await fetch(req, { cache: "no-store" });
          if (net && net.ok) {
            const cache = await caches.open(CACHE);
            // 只缓存最终成功的根路径，不缓存可能 308 的 /index.html
            if (url.pathname === "/" || url.pathname === "") {
              try {
                await cache.put("/", net.clone());
              } catch (_) {}
            }
            return net;
          }
          // 非 ok 也尽量返回网络结果，不吞掉
          if (net) return net;
        } catch (_) {}
        const hit =
          (await caches.match("/")) ||
          (await caches.match(req)) ||
          (await caches.match("/index.html"));
        if (hit) return hit;
        return new Response(
          "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem;background:#0b0f1a;color:#eee'><h1>离线或网络异常</h1><p>请检查网络后下拉刷新。若反复出现，请清除本站数据后重开。</p></body></html>",
          { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
        );
      })()
    );
    return;
  }

  // 静态资源：网络优先，成功则更新缓存
  event.respondWith(
    (async () => {
      try {
        const net = await fetch(req);
        if (net && net.ok) {
          const cache = await caches.open(CACHE);
          try {
            await cache.put(req, net.clone());
          } catch (_) {}
          return net;
        }
        const hit = await caches.match(req);
        return hit || net;
      } catch (_) {
        const hit = await caches.match(req);
        if (hit) return hit;
        throw _;
      }
    })()
  );
});

// 允许页面触发跳过等待
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
