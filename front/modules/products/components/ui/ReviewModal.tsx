import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, User, Star, MessageSquare } from 'lucide-react';
import { StarRating } from './StarRating';
import {
 getProductReviews,
 getProductRating,
 submitReview,
 ProductReview,
 RatingStats,
} from '../../services/reviewService';

interface ReviewModalProps {
 productId: string;
 productName: string;
 currentUserName?: string;
 onClose: () => void;
 onStatsChange?: (stats: RatingStats) => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
 productId,
 productName,
 currentUserName,
 onClose,
 onStatsChange,
}) => {
 const [reviews, setReviews] = useState<ProductReview[]>([]);
 const [stats, setStats] = useState<RatingStats>({ average: 0, total: 0 });
 const [loading, setLoading] = useState(true);

 const [newRating, setNewRating] = useState(5);
 const [newComment, setNewComment] = useState('');
 const [newName, setNewName] = useState(currentUserName || '');
 const [submitting, setSubmitting] = useState(false);
 const [successMsg, setSuccessMsg] = useState(false);

 const load = useCallback(async () => {
 setLoading(true);
 const [r, s] = await Promise.all([
 getProductReviews(productId),
 getProductRating(productId),
 ]);
 setReviews(r);
 setStats(s);
 onStatsChange?.(s);
 setLoading(false);
 }, [productId, onStatsChange]);

 useEffect(() => {
 load();
 }, [load]);

 // Close on Escape key
 useEffect(() => {
 const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
 document.addEventListener('keydown', handler);
 return () => document.removeEventListener('keydown', handler);
 }, [onClose]);

 async function handleSubmit(e: React.FormEvent) {
 e.preventDefault();
 if (!newName.trim() || !newComment.trim() || newRating < 1) return;
 setSubmitting(true);
 await submitReview(productId, newName.trim(), newRating, newComment.trim());
 setSubmitting(false);
 setSuccessMsg(true);
 setNewComment('');
 setNewRating(5);
 await load();
 setTimeout(() => setSuccessMsg(false), 3000);
 }

 const formatDate = (iso: string) =>
 new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });

 const modal = (
 <>
 {/* Backdrop */}
 <div
 className="fixed inset-0 bg-black/50 z-[200]"
 onClick={onClose}
 aria-hidden="true"
 />

 {/* Panel */}
 <div className="fixed inset-0 z-[201] flex items-center justify-center p-4">
 <div
 className="relative w-full max-w-lg max-h-[90vh] flex flex-col bg-surface-raised rounded-2xl shadow-2xl overflow-hidden"
 onClick={(e) => e.stopPropagation()}
 >
 {/* Header */}
 <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
 <div>
 <h2 className="text-lg font-semibold text-content-primary flex items-center gap-2">
 <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
 Avaliações
 </h2>
 <p className="text-sm text-content-muted truncate max-w-xs">{productName}</p>
 </div>
 <button
 onClick={onClose}
 className="p-2 rounded-lg text-content-muted hover:bg-surface-base transition-colors"
 aria-label="Fechar"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 <div className="overflow-y-auto flex-1">
 {/* Stats summary */}
 {stats.total > 0 && (
 <div className="flex items-center gap-6 px-6 py-5 bg-surface-base/50">
 <div className="text-center">
 <p className="text-5xl font-bold text-content-primary leading-none">{stats.average.toFixed(1)}</p>
 <StarRating value={stats.average} size="sm" />
 <p className="text-xs text-content-muted mt-1">{stats.total} avaliações</p>
 </div>
 <div className="flex-1 space-y-1">
 {[5, 4, 3, 2, 1].map((star) => {
 const starCount = reviews.filter((r) => r.rating === star).length;
 const pct = stats.total ? Math.round((starCount / stats.total) * 100) : 0;
 return (
 <div key={star} className="flex items-center gap-2 text-xs text-content-secondary">
 <span className="w-3 text-right">{star}</span>
 <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 flex-shrink-0" />
 <div className="flex-1 h-2 bg-surface-base rounded-full overflow-hidden">
 <div
 className="h-full bg-yellow-400 rounded-full transition-all duration-500"
 style={{ width: `${pct}%` }}
 />
 </div>
 <span className="w-7 text-right">{pct}%</span>
 </div>
 );
 })}
 </div>
 </div>
 )}

 {/* Review form */}
 <form onSubmit={handleSubmit} className="px-6 py-5 border-b border-border-default">
 <h3 className="text-sm font-semibold text-content-primary mb-4 flex items-center gap-2">
 <MessageSquare className="w-4 h-4 text-green-600" />
 Deixar avaliação
 </h3>

 {successMsg && (
 <div className="mb-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-400 px-4 py-2.5 rounded-lg">
 Obrigado pela sua avaliação!
 </div>
 )}

 <div className="space-y-3">
 {/* Name */}
 <div className="relative">
 <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
 <input
 type="text"
 value={newName}
 onChange={(e) => setNewName(e.target.value)}
 placeholder="O seu nome"
 required
 maxLength={50}
 className="w-full pl-9 pr-3 py-2.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
 />
 </div>

 {/* Stars */}
 <div>
 <p className="text-xs text-content-muted mb-1.5">Classificação</p>
 <StarRating value={newRating} onChange={setNewRating} size="lg" />
 </div>

 {/* Comment */}
 <textarea
 value={newComment}
 onChange={(e) => setNewComment(e.target.value)}
 placeholder="Partilhe a sua experiência com este produto..."
 required
 maxLength={500}
 rows={3}
 className="w-full px-3 py-2.5 text-sm border border-border-default rounded-lg bg-surface-raised text-content-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
 />

 <button
 type="submit"
 disabled={submitting || !newName.trim() || !newComment.trim()}
 className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
 >
 <Send className="w-4 h-4" />
 {submitting ? 'A enviar...' : 'Publicar avaliação'}
 </button>
 </div>
 </form>

 {/* Reviews list */}
 <div className="px-6 py-4 space-y-4">
 {loading ? (
 <div className="space-y-3">
 {[1, 2].map((i) => (
 <div key={i} className="animate-pulse space-y-2">
 <div className="h-3 bg-surface-base rounded w-1/3" />
 <div className="h-3 bg-surface-base rounded w-full" />
 <div className="h-3 bg-surface-base rounded w-4/5" />
 </div>
 ))}
 </div>
 ) : reviews.length === 0 ? (
 <p className="text-center text-sm text-content-muted py-6">
 Ainda não há avaliações. Seja o primeiro a avaliar!
 </p>
 ) : (
 reviews.map((r) => (
 <div key={r.id} className="pb-4 border-b border-border-default last:border-0">
 <div className="flex items-start justify-between gap-2">
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
 <span className="text-green-700 dark:text-green-400 text-sm font-semibold">
 {r.user_name.charAt(0).toUpperCase()}
 </span>
 </div>
 <div>
 <p className="text-sm font-semibold text-content-primary">{r.user_name}</p>
 <StarRating value={r.rating} size="sm" />
 </div>
 </div>
 <span className="text-xs text-content-muted flex-shrink-0">{formatDate(r.created_at)}</span>
 </div>
 {r.comment && (
 <p className="mt-2 ml-10 text-sm text-content-secondary leading-relaxed">{r.comment}</p>
 )}
 </div>
 ))
 )}
 </div>
 </div>
 </div>
 </div>
 </>
 );

 return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
};
