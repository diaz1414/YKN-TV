// worker.js
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*"
};
var DIRECT_EXT = /\.(ts|m4s|mp4|m4v|aac|mp3|m4a|fmp4|cmfv|cmfa)(\?.*)?$/i;
var PROXY_EXT = /\.(m3u8|mpd|key|bin)(\?.*)?$/i;
var worker_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }
    const reqUrl = new URL(request.url);
    const path = reqUrl.pathname;
    const normalized = path.replace(/^\/(https?):\/\//, "/$1/");
    const match = normalized.match(/^\/(https?)\/(.+)$/);
    if (!match) {
      return new Response(
        "Invalid proxy URL. Use: /https/domain.com/path?query",
        { status: 400, headers: CORS_HEADERS }
      );
    }
    const protocol = match[1];
    let rest = match[2];
    rest = rest.replace("d12l1ahplmeugs.cloudfront.net", "d1211whpimeups.cloudfront.net");
    rest = rest.replace("smil:rtbg/", "smil:rtbgo/");
    const targetUrlStr = `${protocol}://${rest}${reqUrl.search}`;
    let targetUrl;
    try {
      targetUrl = new URL(targetUrlStr);
    } catch {
      return new Response("Malformed target URL", { status: 400, headers: CORS_HEADERS });
    }
    let referer = targetUrl.origin + "/";
    let origin = targetUrl.origin;
    if (targetUrl.hostname.includes("cloudfront.net") || targetUrlStr.includes("rtbgo")) {
      referer = "https://www.rtbgo.bn/";
      origin = "https://www.rtbgo.bn";
    }
    const upstreamHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": referer,
      "Origin": origin,
      "Accept-Encoding": "identity"
      // don't compress video — it's already encoded
    };
    const range = request.headers.get("Range");
    if (range) upstreamHeaders["Range"] = range;
    const isM3U8 = targetUrl.pathname.endsWith(".m3u8") || targetUrlStr.includes(".m3u8");
    const isMPD = targetUrl.pathname.endsWith(".mpd") || targetUrlStr.includes(".mpd");
    const isManifest = isM3U8 || isMPD;
    if (isManifest) {
      const cache = caches.default;
      const cacheKey = new Request(targetUrlStr);
      const cached = await cache.match(cacheKey);
      if (cached) {
        const res = new Response(cached.body, {
          status: cached.status,
          headers: { ...Object.fromEntries(cached.headers), ...CORS_HEADERS, "X-Cache": "HIT" }
        });
        return res;
      }
    }
    let upstream;
    try {
      upstream = await fetch(targetUrlStr, {
        method: request.method,
        headers: upstreamHeaders,
        body: ["POST", "PUT", "PATCH"].includes(request.method) ? request.body : void 0,
        // CF-specific: don't follow redirects blindly for manifests
        redirect: "follow"
      });
    } catch (err) {
      return new Response(`Proxy fetch error: ${err.message}`, { status: 502, headers: CORS_HEADERS });
    }
    if (upstream.status >= 400) {
      return new Response(
        `Upstream error ${upstream.status}`,
        { status: upstream.status, headers: CORS_HEADERS }
      );
    }
    if (isM3U8) {
      const body = await upstream.text();
      const finalUrl = upstream.url || targetUrlStr;
      const workerOrigin = reqUrl.origin;
      const proxyPrefix = `${workerOrigin}/`;
      if (body.includes("#EXTINF") && !body.includes("#EXT-X-TARGETDURATION") && !body.includes("#EXT-X-STREAM-INF")) {
        const targetLine = body.split("\n").find((l) => {
          const t = l.trim();
          return t && !t.startsWith("#") && (t.startsWith("http") || t.includes(".m3u8") || t.includes(".ts"));
        });
        if (targetLine) {
          const resolved = new URL(targetLine.trim(), finalUrl).toString();
          const clean = resolved.replace(/^(https?):\/\//, "$1/");
          return Response.redirect(`${proxyPrefix}${clean}`, 302);
        }
      }
      const rewritten = body.split("\n").map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        if (trimmed.startsWith("#")) {
          return line.replace(/URI="([^"]+)"/g, (_, p1) => {
            const resolved2 = new URL(p1, finalUrl).toString();
            if (PROXY_EXT.test(resolved2) || resolved2.includes("key") || resolved2.includes("init")) {
              const clean2 = resolved2.replace(/^(https?):\/\//, "$1/");
              return `URI="${proxyPrefix}${clean2}"`;
            }
            return `URI="${resolved2}"`;
          });
        }
        const resolved = new URL(trimmed, finalUrl).toString();
        if (DIRECT_EXT.test(resolved)) {
          return resolved;
        }
        const clean = resolved.replace(/^(https?):\/\//, "$1/");
        return `${proxyPrefix}${clean}`;
      }).join("\n");
      const contentType = upstream.headers.get("content-type") || "application/vnd.apple.mpegurl";
      const response = new Response(rewritten, {
        status: upstream.status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=2, s-maxage=2",
          "X-Cache": "MISS"
        }
      });
      ctx.waitUntil(caches.default.put(new Request(targetUrlStr), response.clone()));
      return response;
    }
    if (isMPD) {
      const body = await upstream.text();
      const finalUrl = upstream.url || targetUrlStr;
      const contentType = upstream.headers.get("content-type") || "application/dash+xml";
      const originBaseUrl = (() => {
        try {
          const u = new URL(finalUrl);
          const dir = u.pathname.replace(/\/[^/]+$/, "/");
          return `${u.origin}${dir}`;
        } catch {
          return null;
        }
      })();
      let rewrittenBody = body;
      if (originBaseUrl) {
        if (!body.includes("<BaseURL>")) {
          rewrittenBody = body.replace(
            /(<Period[^>]*>)/,
            `$1
    <BaseURL>${originBaseUrl}</BaseURL>`
          );
          if (rewrittenBody === body) {
            rewrittenBody = body.replace(
              /(<MPD[^>]*>)/,
              `$1
  <BaseURL>${originBaseUrl}</BaseURL>`
            );
          }
        }
      }
      const response = new Response(rewrittenBody, {
        status: upstream.status,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3, s-maxage=3",
          "X-Cache": "MISS"
        }
      });
      ctx.waitUntil(caches.default.put(new Request(targetUrlStr), response.clone()));
      return response;
    }
    const resHeaders = new Headers(CORS_HEADERS);
    for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
      const val = upstream.headers.get(key);
      if (val) resHeaders.set(key, val);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: resHeaders
    });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
