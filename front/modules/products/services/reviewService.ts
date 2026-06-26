/**
 * reviewService — REST API backend (product_reviews table).
 * GET endpoints are public; POST requires auth token.
 * Falls back to localStorage when backend is unreachable.
 */
import api from '../../core/services/apiClient';

export interface ProductReview {
  id: string;
  product_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface RatingStats {
  average: number;
  total: number;
}

// Per-product stats cache (TTL: 30 s)
const statsCache = new Map<string, { data: RatingStats; ts: number }>();
const CACHE_TTL = 30_000;

const STORAGE_KEY = 'pcshop_reviews';

function getLocalReviews(): ProductReview[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveLocalReviews(reviews: ProductReview[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
}

// ── Stats ────────────────────────────────────────────────────────────────────

export async function getProductRating(productId: string): Promise<RatingStats> {
  const cached = statsCache.get(productId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  try {
    const data = await api.get<{ total: number; average: number }>(`/reviews/stats/${productId}`);
    const stats: RatingStats = { average: Number(data?.average ?? 0), total: Number(data?.total ?? 0) };
    statsCache.set(productId, { data: stats, ts: Date.now() });
    return stats;
  } catch {
    // fallback to localStorage
    const local = getLocalReviews().filter(r => r.product_id === productId);
    if (!local.length) return { average: 0, total: 0 };
    const avg = local.reduce((s, r) => s + r.rating, 0) / local.length;
    return { average: Math.round(avg * 10) / 10, total: local.length };
  }
}

// ── Per-product reviews ───────────────────────────────────────────────────────

export async function getProductReviews(productId: string): Promise<ProductReview[]> {
  try {
    const data = await api.get<ProductReview[]>(`/reviews/product/${productId}`);
    return data || [];
  } catch {
    return getLocalReviews().filter(r => r.product_id === productId);
  }
}

// ── All reviews (for testimonials section) ───────────────────────────────────

export async function getAllReviews(limit = 24): Promise<ProductReview[]> {
  try {
    const data = await api.get<ProductReview[]>(`/reviews?limit=${limit}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ── Submit ────────────────────────────────────────────────────────────────────

export async function submitReview(
  productId: string,
  userName: string,
  rating: number,
  comment: string
): Promise<void> {
  const review: ProductReview = {
    id: crypto.randomUUID(),
    product_id: productId,
    user_name: userName.trim(),
    rating,
    comment: comment.trim(),
    created_at: new Date().toISOString(),
  };

  let savedToBackend = false;
  try {
    await api.post('/reviews', {
      product_id: productId,
      user_name: userName.trim(),
      rating,
      comment: comment.trim(),
    });
    savedToBackend = true;
  } catch { /* fall through */ }

  if (!savedToBackend) {
    // Save locally so the user sees their own review immediately
    const reviews = getLocalReviews();
    reviews.unshift(review);
    saveLocalReviews(reviews);
  }

  statsCache.delete(productId);
}
