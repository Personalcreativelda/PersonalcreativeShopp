import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Instagram, ChevronLeft, ChevronRight } from 'lucide-react';

const API_URL = (import.meta.env.VITE_API_URL as string) || '';

interface InstagramPost {
  id: string;
  imageUrl: string;
  link: string;
}

interface InstagramData {
  posts: InstagramPost[];
  username: string;
  configured: boolean;
}

export const ShopInstagram: React.FC = () => {
  const [data, setData] = useState<InstagramData>({ posts: [], username: 'naturervamz', configured: false });
  const [loading, setLoading] = useState(true);
  const [activeDot, setActiveDot] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/instagram`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => {
        if (json && Array.isArray(json.posts)) setData(json);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getItemWidth = () => scrollRef.current?.firstElementChild?.clientWidth ?? 0;

  const scrollToIndex = useCallback((index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const itemWidth = getItemWidth();
    if (!itemWidth) return;
    el.scrollTo({ left: index * (itemWidth + 12), behavior: 'smooth' });
    setActiveDot(index);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const itemWidth = getItemWidth();
    if (!itemWidth) return;
    setActiveDot(Math.round(el.scrollLeft / (itemWidth + 12)));
  }, []);

  const posts = data.posts ?? [];

  // Auto-advance
  useEffect(() => {
    if (!data.configured || posts.length <= 1) return;
    autoRef.current = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const itemWidth = getItemWidth();
      if (!itemWidth) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScroll - 4) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
        setActiveDot(0);
      } else {
        const next = Math.round(el.scrollLeft / (itemWidth + 12)) + 1;
        scrollToIndex(next);
      }
    }, 3500);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [data.configured, posts.length, scrollToIndex]);

  const stopAuto = () => { if (autoRef.current) clearInterval(autoRef.current); };

  const prev = () => { stopAuto(); scrollToIndex(Math.max(0, activeDot - 1)); };
  const next = () => { stopAuto(); scrollToIndex(activeDot + 1); };

  return (
    <section className="py-14 bg-surface-base">
      <div className="max-w-7xl mx-auto px-4">

        {/* Header */}
        <a
          href={`https://www.instagram.com/${data.username}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 mb-8 group"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
            <Instagram className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-gray-800 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
            Siga @{data.username}
          </span>
        </a>

        {loading ? (
          /* Skeleton */
          <div className="flex gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-1 aspect-square bg-surface-overlay dark:bg-white/[0.1] rounded-2xl animate-pulse" />
            ))}
          </div>

        ) : data.configured && posts.length > 0 ? (
          /* Posts carousel */
          <div className="relative group/carousel">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              onMouseEnter={stopAuto}
              className="flex gap-3 overflow-x-auto scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {posts.map(post => (
                <a
                  key={post.id}
                  href={post.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    flex-shrink-0 snap-start aspect-square rounded-2xl overflow-hidden
                    relative group/post
                    min-w-[calc(50%-6px)] sm:min-w-[calc(33.33%-8px)] lg:min-w-[calc(20%-10px)]
                  "
                >
                  <img
                    src={post.imageUrl}
                    alt="Instagram"
                    className="w-full h-full object-cover group-hover/post:scale-105 transition-transform duration-400"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/post:bg-black/25 transition-colors flex items-center justify-center">
                    <Instagram className="w-7 h-7 text-white opacity-0 group-hover/post:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                </a>
              ))}
            </div>

            {/* Setas */}
            <button
              onClick={prev}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-9 h-9 bg-surface-raised rounded-full shadow-lg flex items-center justify-center text-content-secondary hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover/carousel:opacity-100 disabled:opacity-0"
              disabled={activeDot === 0}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-9 h-9 bg-surface-raised rounded-full shadow-lg flex items-center justify-center text-content-secondary hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover/carousel:opacity-100"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            {/* Dots */}
            <div className="flex justify-center gap-1.5 mt-5">
              {posts.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { stopAuto(); scrollToIndex(i); }}
                  className={`rounded-full transition-all duration-200 ${
                    i === activeDot
                      ? 'w-5 h-2 bg-gray-700 dark:bg-white'
                      : 'w-2 h-2 bg-border-strong dark:bg-white/[0.2] hover:bg-content-muted'
                  }`}
                />
              ))}
            </div>
          </div>

        ) : (
          /* Fallback — token não configurado */
          <div className="flex flex-col items-center gap-5 py-6">
            <a
              href={`https://www.instagram.com/${data.username}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center gap-4"
            >
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xl shadow-pink-400/30">
                <Instagram className="w-12 h-12 text-white" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-800 dark:text-white text-lg">@{data.username}</p>
                <p className="text-sm text-pink-600 dark:text-pink-400 mt-1 group-hover:underline">
                  Ver publicações no Instagram →
                </p>
              </div>
            </a>
          </div>
        )}
      </div>
    </section>
  );
};
