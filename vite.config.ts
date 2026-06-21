import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import axios from 'axios'
import { URL } from 'url'

// A local development CORS proxy helper to mirror Vercel Serverless Function behavior (path-based)
const dynamicCorsProxyPlugin = () => ({
  name: 'dynamic-cors-proxy',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      const host = req.headers.host || 'localhost:5173';
      
      if (!req.url.startsWith('/api/proxy/')) {
        // Fallback check for root query-based "/api/proxy?url=..." requests
        const urlObj = new URL(req.url || '', `http://${host}`);
        if (urlObj.pathname === '/api/proxy' && urlObj.searchParams.get('url')) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', '*');
          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.end();
            return;
          }
          await handleRequest(urlObj.searchParams.get('url')!, host, req, res);
          return;
        }
        next();
        return;
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
      }

      // Normalize path format (convert /api/proxy/https://... to /api/proxy/https/...)
      let cleanUrl = req.url || '';
      cleanUrl = cleanUrl.replace(/^\/api\/proxy\/(https?):\/\//i, '/api/proxy/$1/');

      const match = cleanUrl.match(/^\/api\/proxy\/(https?)\/(.+)$/);
      if (!match) {
        res.statusCode = 400;
        res.end('Invalid proxy request format. Use /api/proxy/https/domain/path?query');
        return;
      }

      const protocol = match[1];
      let rest = match[2];

      // Auto-correct known typos in target URL
      if (rest.includes('d12l1ahplmeugs.cloudfront.net')) {
        rest = rest.replace('d12l1ahplmeugs.cloudfront.net', 'd1211whpimeups.cloudfront.net');
      }
      if (rest.includes('smil:rtbg/')) {
        rest = rest.replace('smil:rtbg/', 'smil:rtbgo/');
      }

      const targetUrlStr = `${protocol}://${rest}`;

      await handleRequest(targetUrlStr, host, req, res);
    });
  }
});

async function handleRequest(url: string, host: string, req: any, res: any) {
  try {
    const targetUrl = new URL(url);
    
    let referer = targetUrl.origin;
    let origin = targetUrl.origin;
    
    // Explicit referer/origin override for RTB Go CloudFront streams to bypass 403 restrictions
    if (targetUrl.hostname.includes('cloudfront.net') || url.includes('rtbgo')) {
      referer = 'https://www.rtbgo.bn/';
      origin = 'https://www.rtbgo.bn';
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': referer,
      'Origin': origin
    };

    if (req.headers['range']) {
      headers['Range'] = req.headers['range'];
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

      let body = response.data;

      // If it's an IPTV container playlist (M3U) pointing to a single HLS stream
      if (typeof body === 'string' && body.includes('#EXTINF') && !body.includes('#EXT-X-TARGETDURATION') && !body.includes('#EXT-X-STREAM-INF')) {
        const lines = body.split('\n');
        const targetLine = lines.find((line: string) => {
          const trimmed = line.trim();
          return trimmed && !trimmed.startsWith('#') && (trimmed.startsWith('http') || trimmed.includes('.m3u8') || trimmed.includes('.ts'));
        });
        
        if (targetLine) {
          const resolvedUrl = new URL(targetLine.trim(), response.request?.res?.responseUrl || url).toString();
          await handleRequest(resolvedUrl, host, req, res);
          return;
        }
      }

      const proto = req.connection.encrypted ? 'https' : 'http';
      const proxyPrefix = `${proto}://${host}/api/proxy/`;
      const finalUrl = response.request?.res?.responseUrl || url;

      const lines = body.split('\n');
      const rewrittenLines = lines.map((line: string) => {
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
  } catch (err: any) {
    console.error('Vite local proxy error:', err.message);
    res.statusCode = 500;
    res.end(`Proxy error: ${err.message}`);
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dynamicCorsProxyPlugin(),
  ],
})
