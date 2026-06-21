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

  // Redirect to VPS proxy (api.ykn.my.id) to save Vercel bandwidth limits
  const targetPath = (req.url || '').replace(/^\/api\/proxy\//, '');
  res.writeHead(307, {
    'Location': `https://api.ykn.my.id/api/proxy/${targetPath}`,
    'Access-Control-Allow-Origin': '*'
  });
  res.end();
}
