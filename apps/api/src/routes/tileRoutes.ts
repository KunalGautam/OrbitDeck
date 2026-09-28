import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import tls from 'tls';

function fetchThroughProxy(
  targetUrl: string,
  proxyUrlStr: string,
  headers: Record<string, string>,
): Promise<{ statusCode: number; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const target = new URL(targetUrl);
    const proxy = new URL(proxyUrlStr);
    const targetPort = target.port || (target.protocol === 'https:' ? '443' : '80');

    const connectReq = http.request({
      host: proxy.hostname,
      port: proxy.port || 8080,
      method: 'CONNECT',
      path: `${target.hostname}:${targetPort}`,
      headers: {
        Host: `${target.hostname}:${targetPort}`,
        ...(proxy.username && proxy.password
          ? {
              'Proxy-Authorization': `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')}`,
            }
          : {}),
      },
    });

    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Proxy CONNECT returned ${res.statusCode}`));
      }

      const tlsSocket = tls.connect({
        socket,
        servername: target.hostname,
      });

      const getReq = https.request(
        {
          host: target.hostname,
          port: targetPort,
          path: target.pathname + target.search,
          method: 'GET',
          headers,
          createConnection: () => tlsSocket,
        },
        (resp) => {
          const chunks: Buffer[] = [];
          resp.on('data', (c: Buffer) => chunks.push(c));
          resp.on('end', () =>
            resolve({
              statusCode: resp.statusCode || 500,
              buffer: Buffer.concat(chunks),
            }),
          );
        },
      );

      getReq.on('error', reject);
      getReq.end();
    });

    connectReq.on('error', reject);
    connectReq.end();
  });
}

export function createTileRouter(): Router {
  const router = Router();
  const cacheDir = path.resolve(process.cwd(), '.cache/osm-tiles');

  try {
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
  } catch (err) {
    console.warn('Could not create tile cache directory:', err);
  }

  router.get('/osm/:z/:x/:y.png', async (req, res) => {
    const { z, x, y } = req.params;
    const zNum = parseInt(z || '', 10);
    const xNum = parseInt(x || '', 10);
    const yNum = parseInt(y || '', 10);

    if (isNaN(zNum) || isNaN(xNum) || isNaN(yNum) || zNum < 0 || zNum > 19) {
      return res.status(400).send('Invalid tile coordinates');
    }

    const tileFileName = `${zNum}_${xNum}_${yNum}.png`;
    const cachedFilePath = path.join(cacheDir, tileFileName);

    // 1. Check local disk cache (cache for at least 7 days per OSM Tile Usage Policy)
    try {
      if (fs.existsSync(cachedFilePath)) {
        const stats = fs.statSync(cachedFilePath);
        const ageMs = Date.now() - stats.mtimeMs;
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (ageMs < sevenDaysMs && stats.size > 0) {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
          return fs.createReadStream(cachedFilePath).pipe(res);
        }
      }
    } catch {
      // If cache read fails, proceed to fetch
    }

    // 2. Resolve upstream URL (supports custom OSM_TILE_URL or OSM_UPSTREAM_URL)
    const upstreamTemplate =
      process.env.OSM_TILE_URL ||
      process.env.OSM_UPSTREAM_URL ||
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    const osmUrl = upstreamTemplate
      .replace('{z}', String(zNum))
      .replace('{x}', String(xNum))
      .replace('{y}', String(yNum));

    const headers: Record<string, string> = {
      'User-Agent':
        'OrbitDeck/1.0 (+https://github.com/KunalGautam/OrbitDeck; contact@orbitdeck.local)',
      Referer: 'https://github.com/KunalGautam/OrbitDeck',
    };

    const proxyUrlStr =
      process.env.HTTPS_PROXY ||
      process.env.HTTP_PROXY ||
      process.env.https_proxy ||
      process.env.http_proxy;

    try {
      let buffer: Buffer;

      if (proxyUrlStr && osmUrl.startsWith('https:')) {
        // Fetch via outbound proxy
        const result = await fetchThroughProxy(osmUrl, proxyUrlStr, headers);
        if (result.statusCode < 200 || result.statusCode >= 300) {
          return res.status(result.statusCode).send('Tile fetch error via proxy');
        }
        buffer = result.buffer;
      } else {
        // Direct fetch
        const response = await fetch(osmUrl, { headers });
        if (!response.ok) {
          return res.status(response.status).send('Tile fetch error');
        }
        buffer = Buffer.from(await response.arrayBuffer());
      }

      // Save to local cache asynchronously
      try {
        fs.writeFile(cachedFilePath, buffer, (err) => {
          if (err) console.warn('Failed to cache tile:', err);
        });
      } catch {
        // Non-blocking cache write failure
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      return res.send(buffer);
    } catch (err) {
      console.error('Error fetching OSM tile:', err);
      return res.status(502).send('Error fetching tile from upstream');
    }
  });

  return router;
}
