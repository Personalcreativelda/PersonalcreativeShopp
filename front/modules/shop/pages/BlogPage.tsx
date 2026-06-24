import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Eye, Tag, Loader2, FileText } from 'lucide-react';
import api from '../../core/services/apiClient';

interface BlogPost {
  id: string; title: string; slug: string; summary?: string;
  coverImage?: string; authorName?: string; status: string;
  tags: string[]; views: number; publishedAt?: string; createdAt: string;
}

export const BlogPage: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<BlogPost[]>('/blog')
      .then(data => setPosts(data.filter(p => p.status === 'published')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-MZ', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-content-primary mb-2">Blog NaturErva</h1>
          <p className="text-content-muted">Dicas de saúde, nutrição e bem-estar natural</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-green-600" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Ainda não há artigos publicados.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => (
              <Link key={post.id} to={`/blog/${post.slug}`}
                className="bg-surface-raised rounded-2xl overflow-hidden border border-border-default shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
                {post.coverImage ? (
                  <img src={post.coverImage} alt={post.title} className="w-full h-44 object-cover" />
                ) : (
                  <div className="w-full h-44 bg-gradient-to-br from-green-100 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/20 flex items-center justify-center">
                    <FileText className="w-12 h-12 text-green-400 opacity-40" />
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <h2 className="font-bold text-content-primary text-lg leading-snug mb-2 line-clamp-2">{post.title}</h2>
                  {post.summary && <p className="text-content-muted text-sm line-clamp-3 mb-3 flex-1">{post.summary}</p>}
                  <div className="flex items-center justify-between text-xs text-content-muted mt-auto pt-3 border-t border-border-default">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(post.publishedAt || post.createdAt)}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.views}</span>
                  </div>
                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {post.tags.slice(0, 3).map(t => (
                        <span key={t} className="flex items-center gap-0.5 px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-[10px] font-medium">
                          <Tag className="w-2.5 h-2.5" />{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogPage;
