import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Star, MessageSquare } from 'lucide-react';
import { getAllReviews, ProductReview } from '../../products/services/reviewService';

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
};

const StarRow: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex justify-center gap-0.5 mt-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-border-strong dark:text-white/[0.18]'}`}
      />
    ))}
  </div>
);

const ReviewCard: React.FC<{ review: ProductReview }> = ({ review }) => (
  <div className="bg-surface-raised rounded-2xl p-6 flex flex-col items-center text-center relative shadow-sm border border-border-default h-full">
    <span className="text-5xl text-border-default dark:text-white/[0.15] leading-none select-none absolute top-3 left-4 font-serif">
      &#8220;
    </span>
    <p className="text-content-secondary text-sm leading-relaxed mt-6 mb-4 px-2 flex-1">
      {review.comment}
    </p>
    <div>
      <p className="font-bold text-content-primary text-sm">{review.user_name}</p>
      <p className="text-xs text-content-muted mt-0.5">{formatDate(review.created_at)}</p>
      <StarRow rating={review.rating} />
    </div>
    <span className="text-5xl text-border-default dark:text-white/[0.15] leading-none select-none absolute bottom-3 right-4 font-serif">
      &#8221;
    </span>
  </div>
);

const SkeletonCard = () => (
  <div className="bg-surface-raised rounded-2xl p-6 border border-border-default animate-pulse">
    <div className="h-3 bg-surface-overlay rounded w-4/5 mx-auto mt-4 mb-2" />
    <div className="h-3 bg-surface-overlay rounded w-3/5 mx-auto mb-2" />
    <div className="h-3 bg-surface-overlay rounded w-2/3 mx-auto mb-6" />
    <div className="h-3 bg-surface-overlay rounded w-1/3 mx-auto mb-1" />
    <div className="h-2 bg-surface-overlay rounded w-1/4 mx-auto mb-2" />
    <div className="flex justify-center gap-1 mt-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="w-4 h-4 bg-yellow-100 dark:bg-yellow-900/30 rounded" />
      ))}
    </div>
  </div>
);

const VISIBLE_DESKTOP = 3;

export const TestimonialsSection: React.FC = () => {
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [startIndex, setStartIndex] = useState(0);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    getAllReviews(24)
      .then(data => setReviews(data))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, []);

  const totalPages = Math.max(0, reviews.length - VISIBLE_DESKTOP + 1);

  const goTo = useCallback((index: number) => {
    setStartIndex(Math.max(0, Math.min(index, reviews.length - VISIBLE_DESKTOP)));
  }, [reviews.length]);

  // Auto-advance
  useEffect(() => {
    if (reviews.length <= VISIBLE_DESKTOP) return;
    autoRef.current = setInterval(() => {
      setStartIndex(i => {
        const next = i + 1;
        return next > reviews.length - VISIBLE_DESKTOP ? 0 : next;
      });
    }, 5000);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [reviews.length]);

  const stopAuto = () => { if (autoRef.current) clearInterval(autoRef.current); };

  const prev = () => { stopAuto(); goTo(startIndex - 1); };
  const next = () => { stopAuto(); goTo(startIndex + 1); };

  // Não mostrar a secção se não há reviews e terminou de carregar
  if (!loading && reviews.length === 0) return null;

  const visible = reviews.slice(startIndex, startIndex + VISIBLE_DESKTOP);

  return (
    <section className="py-16 bg-surface-base">
      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-white mb-2">
          Veja o que falam da nossa loja
        </h2>
        <p className="text-center text-content-muted text-sm mb-10">
          Avaliações reais dos nossos clientes
        </p>

        {loading ? (
          /* Skeleton */
          <>
            <div className="hidden sm:grid grid-cols-3 gap-5 mx-12">
              {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
            </div>
            <div className="sm:hidden">
              <SkeletonCard />
            </div>
          </>
        ) : (
          <>
            {/* Desktop carousel */}
            <div className="hidden sm:flex items-stretch gap-4">
              <button
                onClick={prev}
                disabled={startIndex === 0}
                className="flex-shrink-0 w-10 h-10 self-center rounded-full border border-gray-300 dark:border-border-strong flex items-center justify-center bg-surface-raised shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-5 h-5 text-content-secondary" />
              </button>

              <div className="flex-1 grid grid-cols-3 gap-5">
                {visible.map((r, i) => (
                  <ReviewCard key={r.id ?? startIndex + i} review={r} />
                ))}
              </div>

              <button
                onClick={next}
                disabled={startIndex >= reviews.length - VISIBLE_DESKTOP}
                className="flex-shrink-0 w-10 h-10 self-center rounded-full border border-gray-300 dark:border-border-strong flex items-center justify-center bg-surface-raised shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-30 transition"
              >
                <ChevronRight className="w-5 h-5 text-content-secondary" />
              </button>
            </div>

            {/* Mobile: single card */}
            <div className="sm:hidden">
              <div className="flex items-center gap-3">
                <button
                  onClick={prev}
                  disabled={startIndex === 0}
                  className="flex-shrink-0 w-9 h-9 rounded-full border border-gray-300 dark:border-border-strong flex items-center justify-center bg-surface-raised shadow-sm disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4 text-content-secondary" />
                </button>
                <div className="flex-1">
                  <ReviewCard review={reviews[startIndex]} />
                </div>
                <button
                  onClick={next}
                  disabled={startIndex >= reviews.length - 1}
                  className="flex-shrink-0 w-9 h-9 rounded-full border border-gray-300 dark:border-border-strong flex items-center justify-center bg-surface-raised shadow-sm disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4 text-content-secondary" />
                </button>
              </div>
              <div className="flex justify-center gap-2 mt-5">
                {reviews.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { stopAuto(); setStartIndex(i); }}
                    className={`rounded-full transition-all duration-200 ${
                      i === startIndex
                        ? 'w-5 h-2 bg-green-600 dark:bg-green-400'
                        : 'w-2 h-2 bg-border-strong dark:bg-white/[0.18]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Desktop dots */}
            {totalPages > 1 && (
              <div className="hidden sm:flex justify-center gap-2 mt-6">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { stopAuto(); goTo(i); }}
                    className={`rounded-full transition-all duration-200 ${
                      i === startIndex
                        ? 'w-5 h-2 bg-green-600 dark:bg-green-400'
                        : 'w-2 h-2 bg-border-strong dark:bg-white/[0.18] hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
