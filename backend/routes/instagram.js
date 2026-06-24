import express from 'express';

const router = express.Router();

// Cache simples em memória (evitar bater na API a cada request)
let cache = { posts: [], username: '', timestamp: 0 };
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

router.get('/', async (req, res) => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const username = process.env.INSTAGRAM_USERNAME || 'naturervamz';

  if (!token) {
    return res.json({ posts: [], username, configured: false });
  }

  // Servir do cache se ainda válido
  if (cache.timestamp && Date.now() - cache.timestamp < CACHE_TTL && cache.posts.length > 0) {
    return res.json({ posts: cache.posts, username: cache.username || username, configured: true });
  }

  try {
    const response = await fetch(
      `https://graph.instagram.com/me/media?fields=id,media_type,media_url,thumbnail_url,permalink&limit=9&access_token=${token}`
    );

    if (!response.ok) {
      return res.json({ posts: [], username, configured: false });
    }

    const data = await response.json();

    if (data.error) {
      console.warn('[Instagram] API error:', data.error.message);
      return res.json({ posts: [], username, configured: false });
    }

    const posts = (data.data || [])
      .filter(p => ['IMAGE', 'CAROUSEL_ALBUM'].includes(p.media_type))
      .slice(0, 9)
      .map(p => ({
        id: p.id,
        imageUrl: p.media_url || p.thumbnail_url,
        link: p.permalink,
      }));

    // Guardar no cache
    cache = { posts, username, timestamp: Date.now() };

    res.json({ posts, username, configured: true });
  } catch (err) {
    console.error('[Instagram] Fetch error:', err.message);
    res.json({ posts: [], username, configured: false });
  }
});

export default router;
