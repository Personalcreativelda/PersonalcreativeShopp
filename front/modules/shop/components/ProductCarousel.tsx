import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Product, ProductVariant } from '../../core/types/types';
import { ProductCard } from '../../products/components/ui/ProductCard';

const GAP = 16;

export const ProductCarousel: React.FC<{
  title: string;
  products: Product[];
  badge?: React.ReactNode;
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
  onNotify?: () => void;
  currentUserName?: string;
}> = ({ title, products, badge, onAddToCart, onNotify, currentUserName }) => {
  const [current, setCurrent] = useState(0);
  const [visibleCount, setVisibleCount] = useState(4);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxIndex = Math.max(0, products.length - visibleCount);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setContainerWidth(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setVisibleCount(w < 640 ? 2 : w < 1024 ? 3 : 4);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    setCurrent(c => Math.min(c, Math.max(0, products.length - visibleCount)));
  }, [visibleCount, products.length]);

  const stopAuto = useCallback(() => {
    if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null; }
  }, []);

  useEffect(() => {
    if (products.length <= visibleCount) return;
    autoRef.current = setInterval(() => {
      setCurrent(c => (c >= maxIndex ? 0 : c + 1));
    }, 4000);
    return stopAuto;
  }, [products.length, visibleCount, maxIndex, stopAuto]);

  const goTo = useCallback((idx: number) => {
    stopAuto();
    setCurrent(Math.max(0, Math.min(idx, maxIndex)));
  }, [maxIndex, stopAuto]);

  if (products.length === 0) return null;

  const step = containerWidth > 0 ? (containerWidth + GAP) / visibleCount : 0;
  const translateX = -(current * step);
  const cardFlex = `0 0 calc(${100 / visibleCount}% - ${GAP * (visibleCount - 1) / visibleCount}px)`;
  const showNav = products.length > visibleCount;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-xl font-bold text-content-primary">{title}</h2>
        {badge}
      </div>

      {/* Track — relative wrapper so buttons overlap the cards */}
      <div className="relative">
        <div ref={containerRef} className="overflow-hidden rounded-2xl">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ gap: `${GAP}px`, transform: `translateX(${translateX}px)` }}
          >
            {products.map((product, i) => (
              <div key={product.id} style={{ flex: cardFlex, minWidth: 0 }}>
                <ProductCard
                  product={product}
                  onAddToCart={onAddToCart}
                  onNotify={onNotify}
                  isMobile={visibleCount <= 2}
                  index={i}
                  currentUserName={currentUserName}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Botões overlay — mesmo estilo do banner */}
        {showNav && (
          <>
            <button
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              aria-label="Anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-surface-raised/80 dark:bg-surface-raised/80 backdrop-blur-sm rounded-full border border-border-default shadow-md flex items-center justify-center text-content-secondary hover:bg-surface-raised disabled:opacity-0 disabled:pointer-events-none transition-all duration-200 z-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => goTo(current + 1)}
              disabled={current >= maxIndex}
              aria-label="Próximo"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-surface-raised/80 dark:bg-surface-raised/80 backdrop-blur-sm rounded-full border border-border-default shadow-md flex items-center justify-center text-content-secondary hover:bg-surface-raised disabled:opacity-0 disabled:pointer-events-none transition-all duration-200 z-10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* Dots */}
      {showNav && (
        <div className="flex justify-center gap-1.5 mt-4">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? 'w-5 h-2'
                  : 'w-2 h-2 bg-border-strong dark:bg-white/[0.18] hover:bg-gray-400'
              }`}
              style={i === current ? { background: 'var(--brand-600)' } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
};
