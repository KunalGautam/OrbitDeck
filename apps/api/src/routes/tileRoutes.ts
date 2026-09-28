import { Router } from 'express';
import fs from 'fs';
import path from 'path';

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

    // 2. Fetch from OSM with required User-Agent and Referer headers
    try {
      const osmUrl = `https://tile.openstreetmap.org/${zNum}/${xNum}/${yNum}.png`;
      const response = await fetch(osmUrl, {
        headers: {
          'User-Agent':
            'OrbitDeck/1.0 (+https://github.com/KunalGautam/OrbitDeck; contact@orbitdeck.local)',
          Referer: 'https://github.com/KunalGautam/OrbitDeck',
        },
      });

      if (!response.ok) {
        return res.status(response.status).send('Tile fetch error');
      }

      const buffer = Buffer.from(await response.arrayBuffer());

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
