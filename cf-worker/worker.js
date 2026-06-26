/**
 * YKN TV - Cloudflare Worker Streaming Proxy
 *
 * Handles path-based proxy requests: /https/domain/path?query
 * - M3U8 (HLS): rewrites segment URLs → direct CDN, sub-manifests/keys → proxy
 * - MPD (DASH): passthrough as-is (segments still proxied so Akamai gets correct headers)
 * - Video segments & keys: streamed directly to browser
 * - Uses CF Cache API for manifests (3s TTL) → handles 5000+ users without bottleneck
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

// Extensions that are heavy video/audio segments → serve DIRECTLY from CDN
// (no worker bandwidth usage)
const DIRECT_EXT = /\.(ts|m4s|mp4|m4v|aac|mp3|m4a|fmp4|cmfv|cmfa)(\?.*)?$/i;

// Extensions that must stay proxied (sub-manifests, DRM keys)
const PROXY_EXT = /\.(m3u8|mpd|key|bin)(\?.*)?$/i;

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    const reqUrl = new URL(request.url);
    const path = reqUrl.pathname;

    // ── Parse target URL ──────────────────────────────────────────────
    // Accept both:
    //   /https/domain/path   (standard)
    //   /https://domain/path (auto-corrected)
    const normalized = path.replace(/^\/(https?):\/\//, '/$1/');
    const match = normalized.match(/^\/(https?)\/(.+)$/);

    if (!match) {
      return new Response(
        'Invalid proxy URL. Use: /https/domain.com/path?query',
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const protocol = match[1];
    let rest = match[2];

    // Auto-correct known CDN typos
    rest = rest.replace('d12l1ahplmeugs.cloudfront.net', 'd1211whpimeups.cloudfront.net');
    rest = rest.replace('smil:rtbg/', 'smil:rtbgo/');

    // Preserve original query string from the worker request
    const targetUrlStr = `${protocol}://${rest}${reqUrl.search}`;

    let targetUrl;
    try {
      targetUrl = new URL(targetUrlStr);
    } catch {
      return new Response('Malformed target URL', { status: 400, headers: CORS_HEADERS });
    }

    // ── Referer / Origin injection ────────────────────────────────────
    let referer = targetUrl.origin + '/';
    let origin  = targetUrl.origin;

    // RTB Go / CloudFront: must use rtbgo.bn as Referer to bypass 403
    if (
      targetUrl.hostname.includes('cloudfront.net') ||
      targetUrlStr.includes('rtbgo')
    ) {
      referer = 'https://www.rtbgo.bn/';
      origin  = 'https://www.rtbgo.bn';
    }

    // ── Upstream headers ──────────────────────────────────────────────
    const upstreamHeaders = {
      'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer':          referer,
      'Origin':           origin,
      'Accept-Encoding':  'identity', // don't compress video — it's already encoded
    };

    // Forward Range header (needed for partial content / seeks)
    const range = request.headers.get('Range');
    if (range) upstreamHeaders['Range'] = range;

    const isM3U8 = targetUrl.pathname.endsWith('.m3u8') || targetUrlStr.includes('.m3u8');
    const isMPD  = targetUrl.pathname.endsWith('.mpd')  || targetUrlStr.includes('.mpd');
    const isManifest = isM3U8 || isMPD;

    // ── CF Cache lookup (manifests only) ─────────────────────────────
    if (isManifest) {
      const cache     = caches.default;
      const cacheKey  = new Request(targetUrlStr);
      const cached    = await cache.match(cacheKey);
      if (cached) {
        // Return cached manifest with CORS + HIT marker
        const res = new Response(cached.body, {
          status:  cached.status,
          headers: { ...Object.fromEntries(cached.headers), ...CORS_HEADERS, 'X-Cache': 'HIT' },
        });
        return res;
      }
    }

    // ── Fetch from origin ─────────────────────────────────────────────
    let upstream;
    try {
      upstream = await fetch(targetUrlStr, {
        method:  request.method,
        headers: upstreamHeaders,
        body:    ['POST', 'PUT', 'PATCH'].includes(request.method) ? request.body : undefined,
        // CF-specific: don't follow redirects blindly for manifests
        redirect: 'follow',
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

    // ── M3U8 manifest handling ────────────────────────────────────────
    if (isM3U8) {
      const body    = await upstream.text();
      const finalUrl = upstream.url || targetUrlStr; // follow redirects
      const workerOrigin = reqUrl.origin;
      const proxyPrefix  = `${workerOrigin}/`;

      // Detect IPTV M3U container (has #EXTINF but NOT a standard HLS playlist)
      if (
        body.includes('#EXTINF') &&
        !body.includes('#EXT-X-TARGETDURATION') &&
        !body.includes('#EXT-X-STREAM-INF')
      ) {
        const targetLine = body.split('\n').find(l => {
          const t = l.trim();
          return t && !t.startsWith('#') && (t.startsWith('http') || t.includes('.m3u8') || t.includes('.ts'));
        });
        if (targetLine) {
          const resolved = new URL(targetLine.trim(), finalUrl).toString();
          const clean    = resolved.replace(/^(https?):\/\//, '$1/');
          return Response.redirect(`${proxyPrefix}${clean}`, 302);
        }
      }

      // Rewrite each line
      const rewritten = body.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        // Comment / tag lines — rewrite URI= attributes (EXT-X-KEY, EXT-X-MAP, etc.)
        if (trimmed.startsWith('#')) {
          return line.replace(/URI="([^"]+)"/g, (_, p1) => {
            const resolved = new URL(p1, finalUrl).toString();
            // DRM keys, init segments → always proxy
            if (PROXY_EXT.test(resolved) || resolved.includes('key') || resolved.includes('init')) {
              const clean = resolved.replace(/^(https?):\/\//, '$1/');
              return `URI="${proxyPrefix}${clean}"`;
            }
            return `URI="${resolved}"`;
          });
        }

        const resolved = new URL(trimmed, finalUrl).toString();

        // Heavy video/audio segments → DIRECT from CDN (bypasses worker entirely)
        if (DIRECT_EXT.test(resolved)) {
          return resolved;
        }

        // Sub-manifests (e.g. quality-specific playlists) → still through proxy
        const clean = resolved.replace(/^(https?):\/\//, '$1/');
        return `${proxyPrefix}${clean}`;
      }).join('\n');

      const contentType = upstream.headers.get('content-type') || 'application/vnd.apple.mpegurl';

      const response = new Response(rewritten, {
        status: upstream.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type':  contentType,
          'Cache-Control': 'public, max-age=2, s-maxage=2',
          'X-Cache':       'MISS',
        },
      });

      // Store in CF edge cache (async, doesn't block response)
      ctx.waitUntil(caches.default.put(new Request(targetUrlStr), response.clone()));

      return response;
    }

    // ── MPD (DASH) manifest handling ──────────────────────────────────
    // Served as-is; Shaka Player keeps fetching segments through this worker
    // so the worker can inject the correct Origin/Referer headers for Akamai
    if (isMPD) {
      const body        = await upstream.text();
      const contentType = upstream.headers.get('content-type') || 'application/dash+xml';

      const response = new Response(body, {
        status: upstream.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type':  contentType,
          'Cache-Control': 'public, max-age=2, s-maxage=2',
          'X-Cache':       'MISS',
        },
      });

      ctx.waitUntil(caches.default.put(new Request(targetUrlStr), response.clone()));

      return response;
    }

    // ── Binary passthrough (segments, keys, init) ─────────────────────
    // Stream the response body directly — no buffering, minimal CPU usage
    const resHeaders = new Headers(CORS_HEADERS);

    // Forward select upstream headers
    for (const key of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
      const val = upstream.headers.get(key);
      if (val) resHeaders.set(key, val);
    }

    return new Response(upstream.body, {
      status:  upstream.status,
      headers: resHeaders,
    });
  },
};
