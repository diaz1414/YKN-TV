import axios from 'axios';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // Normalize path format (convert /api/proxy/https://... to /api/proxy/https/...)
  let cleanUrl = req.url || '';
  cleanUrl = cleanUrl.replace(/^\/api\/proxy\/(https?):\/\//i, '/api/proxy/$1/');

  // Extract target URL from path or query parameters
  let targetUrlStr = '';
  const match = cleanUrl.match(/^\/api\/proxy\/(https?)\/(.+)$/);
  if (match) {
    const protocol = match[1];
    let rest = match[2];
    
    // Auto-correct known typos in target URL
    if (rest.includes('d12l1ahplmeugs.cloudfront.net')) {
      rest = rest.replace('d12l1ahplmeugs.cloudfront.net', 'd1211whpimeups.cloudfront.net');
    }
    if (rest.includes('smil:rtbg/')) {
      rest = rest.replace('smil:rtbg/', 'smil:rtbgo/');
    }
    targetUrlStr = `${protocol}://${rest}`;
  } else {
    const queryUrl = req.query.url;
    if (queryUrl) {
      let correctedQueryUrl = queryUrl;
      if (correctedQueryUrl.includes('d12l1ahplmeugs.cloudfront.net')) {
        correctedQueryUrl = correctedQueryUrl.replace('d12l1ahplmeugs.cloudfront.net', 'd1211whpimeups.cloudfront.net');
      }
      if (correctedQueryUrl.includes('smil:rtbg/')) {
        correctedQueryUrl = correctedQueryUrl.replace('smil:rtbg/', 'smil:rtbgo/');
      }
      targetUrlStr = correctedQueryUrl;
    }
  }

  if (!targetUrlStr) {
    res.statusCode = 400;
    res.end('Invalid proxy request format. Use /api/proxy/https/domain/path?query');
    return;
  }

  const isCloudfront = targetUrlStr.includes('cloudfront.net') || targetUrlStr.includes('rtbgo');

  if (isCloudfront) {
    // Redirect cloudfront streams directly to the target URL (browser can play them directly)
    res.writeHead(307, {
      'Location': targetUrlStr,
      'Access-Control-Allow-Origin': '*'
    });
    res.end();
    return;
  } else {
    // Redirect other proxy requests to the VPS to completely save Vercel bandwidth and execution limits
    const cleanTargetPath = targetUrlStr.replace(/^(https?):\/\//, '$1/');
    res.writeHead(307, {
      'Location': `https://api.ykn.my.id/api/proxy/${cleanTargetPath}`,
      'Access-Control-Allow-Origin': '*'
    });
    res.end();
    return;
  }
}

async function handleRequest(url, req, res) {
  try {
    const targetUrl = new URL(url);
    
    let referer = targetUrl.origin;
    let origin = targetUrl.origin;
    
    // Explicit referer/origin override for RTB Go CloudFront streams to bypass 403 restrictions
    if (targetUrl.hostname.includes('cloudfront.net') || url.includes('rtbgo')) {
      referer = 'https://www.rtbgo.bn/';
      origin = 'https://www.rtbgo.bn';
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': referer,
      'Origin': origin
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

      let body = response.data;

      // If it's an IPTV container playlist (M3U) pointing to a single HLS stream
      if (typeof body === 'string' && body.includes('#EXTINF') && !body.includes('#EXT-X-TARGETDURATION') && !body.includes('#EXT-X-STREAM-INF')) {
        const lines = body.split('\n');
        const targetLine = lines.find((line) => {
          const trimmed = line.trim();
          return trimmed && !trimmed.startsWith('#') && (trimmed.startsWith('http') || trimmed.includes('.m3u8') || trimmed.includes('.ts'));
        });
        
        if (targetLine) {
          const resolvedUrl = new URL(targetLine.trim(), response.request?.res?.responseUrl || url).toString();
          await handleRequest(resolvedUrl, req, res);
          return;
        }
      }

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
