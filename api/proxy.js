import axios from 'axios';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Parse path-based target URL
  // req.url is like: /api/proxy/https/stitcher.pluto.tv/foo?token=123
  const match = (req.url || '').match(/^\/api\/proxy\/(https?)\/(.+)$/);
  if (!match) {
    // Fallback to query parameter check just in case
    const queryUrl = req.query.url;
    if (queryUrl) {
      await handleRequest(queryUrl, req, res);
      return;
    }
    res.statusCode = 400;
    res.end('Invalid proxy request format. Use /api/proxy/https/domain/path?query');
    return;
  }

  const protocol = match[1];
  const rest = match[2];
  const targetUrlStr = `${protocol}://${rest}`;

  await handleRequest(targetUrlStr, req, res);
}

async function handleRequest(url, req, res) {
  try {
    const targetUrl = new URL(url);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': targetUrl.origin
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const isM3U8 = targetUrl.pathname.endsWith('.m3u8') || url.includes('m3u8');

    if (isM3U8) {
      const response = await axios.get(url, {
        headers,
        responseType: 'text',
        timeout: 10000,
        validateStatus: () => true
      });

      if (response.status >= 400) {
        res.statusCode = response.status;
        res.end(`Target server returned error status: ${response.status}`);
        return;
      }

      const body = response.data;
      const proto = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host;
      const proxyPrefix = `${proto}://${host}/api/proxy/`;
      const finalUrl = response.request?.res?.responseUrl || url;

      const lines = body.split('\n');
      const rewrittenLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        if (trimmed.startsWith('#')) {
          return line.replace(/URI="([^"]+)"/g, (_, p1) => {
            const resolved = new URL(p1, finalUrl).toString();
            const cleanResolved = resolved.replace(/^(https?):\/\//, '$1/');
            return `URI="${proxyPrefix}${cleanResolved}"`;
          });
        }

        const resolved = new URL(trimmed, finalUrl).toString();
        const cleanResolved = resolved.replace(/^(https?):\/\//, '$1/');
        return `${proxyPrefix}${cleanResolved}`;
      });

      res.setHeader('Content-Type', response.headers['content-type'] || 'application/vnd.apple.mpegurl');
      res.statusCode = response.status;
      res.end(rewrittenLines.join('\n'));
    } else {
      const response = await axios.get(url, {
        headers,
        responseType: 'stream',
        timeout: 15000,
        validateStatus: () => true
      });

      if (response.status >= 400) {
        res.statusCode = response.status;
        res.end(`Target server returned error status: ${response.status}`);
        return;
      }

      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      }
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }
      if (response.headers['content-range']) {
        res.setHeader('Content-Range', response.headers['content-range']);
      }
      if (response.headers['accept-ranges']) {
        res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
      }

      res.statusCode = response.status;
      response.data.pipe(res);
    }
  } catch (err) {
    console.error('Vercel proxy error:', err.message);
    res.statusCode = 500;
    res.end(`Proxy error: ${err.message}`);
  }
}
