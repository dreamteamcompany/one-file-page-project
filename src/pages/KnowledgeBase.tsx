import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/utils/api';
import { useToast } from '@/hooks/use-toast';
import func2url from '../../backend/func2url.json';
import KBArticleList from './knowledge-base/KBArticleList';
import KBArticleView from './knowledge-base/KBArticleView';
import KBArticleEditor from './knowledge-base/KBArticleEditor';
import {
  ArticleFull,
  ArticleListItem,
  Category,
  Comment,
  Mode,
  Tag,
  getStoredAuthToken,
} from './knowledge-base/types';

const KB_URL = (func2url as Record<string, string>)['api-knowledge-base'];

 
const _kbApiFetchRef = apiFetch;

const KnowledgeBase = () => {
  const navigate = useNavigate();
  const { hasPermission, token, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const getToken = () => token || getStoredAuthToken();
  const authHeaders = (json = false): Record<string, string> => {
    const h: Record<string, string> = { 'X-Auth-Token': getToken() };
    if (json) h['Content-Type'] = 'application/json';
    return h;
  };
  const canRead = hasPermission('knowledge_base', 'read');
  const canWrite =
    hasPermission('knowledge_base', 'write') ||
    hasPermission('knowledge_base', 'create') ||
    hasPermission('knowledge_base', 'update');

  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [popular, setPopular] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ArticleListItem[]>([]);
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [filterTag, setFilterTag] = useState<number | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showAllArticles, setShowAllArticles] = useState(false);
  const [sortBy, setSortBy] = useState<'new' | 'popular'>('new');

  const [mode, setMode] = useState<Mode>('list');
  const [activeArticle, setActiveArticle] = useState<ArticleFull | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');

  // editor state
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
  const [editTagIds, setEditTagIds] = useState<number[]>([]);
  const [editPublished, setEditPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  // category management
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatParent, setNewCatParent] = useState<number | null>(null);

  useEffect(() => {
    if (!canRead) navigate('/');
  }, [canRead, navigate]);

  const loadCategories = async () => {
    const res = await fetch(`${KB_URL}?endpoint=categories`, {
      headers: authHeaders(),
    });
    if (res.ok) setCategories(await res.json());
  };
  const loadTags = async () => {
    const res = await fetch(`${KB_URL}?endpoint=tags`, {
      headers: authHeaders(),
    });
    if (res.ok) setTags(await res.json());
  };
  const loadArticles = async () => {
    const params = new URLSearchParams({ endpoint: 'articles', limit: '100' });
    if (filterCategory) params.set('category_id', String(filterCategory));
    if (filterTag) params.set('tag_id', String(filterTag));
    if (showFavorites) params.set('favorites', '1');
    const res = await fetch(`${KB_URL}?${params}`, {
      headers: authHeaders(),
    });
    if (res.ok) setArticles(await res.json());
  };
  const loadPopular = async () => {
    const res = await fetch(`${KB_URL}?endpoint=popular`, {
      headers: authHeaders(),
    });
    if (res.ok) setPopular(await res.json());
  };

  useEffect(() => {
    if (authLoading) return;
    if (!getToken()) return;
    (async () => {
      setLoading(true);
      await Promise.all([loadCategories(), loadTags(), loadPopular()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, token]);

  useEffect(() => {
    if (authLoading) return;
    if (!getToken()) return;
    loadArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory, filterTag, showFavorites, authLoading, token]);

  // Поиск с дебаунсом
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`${KB_URL}?endpoint=search&q=${encodeURIComponent(search)}`, {
        headers: authHeaders(),
      });
      if (res.ok) setSearchResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openArticle = async (id: number) => {
    const res = await fetch(`${KB_URL}?endpoint=article&id=${id}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return;
    const a: ArticleFull = await res.json();
    setActiveArticle(a);
    setMode('view');
    // increment view
    fetch(`${KB_URL}?endpoint=view`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ article_id: id }),
    });
    // load comments
    const cr = await fetch(`${KB_URL}?endpoint=comments&article_id=${id}`, {
      headers: authHeaders(),
    });
    if (cr.ok) setComments(await cr.json());
  };

  const startNewArticle = () => {
    setActiveArticle(null);
    setEditTitle('');
    setEditSummary('');
    setEditContent('');
    setEditCategoryId(filterCategory);
    setEditTagIds([]);
    setEditPublished(true);
    setMode('new');
  };

  const startEditArticle = () => {
    if (!activeArticle) return;
    setEditTitle(activeArticle.title);
    setEditSummary(activeArticle.summary || '');
    setEditContent(activeArticle.content_html || '');
    setEditCategoryId(activeArticle.category_id);
    setEditTagIds(activeArticle.tags.map((t) => t.id));
    setEditPublished(activeArticle.is_published);
    setMode('edit');
  };

  const handleSaveArticle = async () => {
    if (!editTitle.trim()) {
      toast({ title: 'Заголовок обязателен', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const isNew = mode === 'new';
    try {
      const body: Record<string, unknown> = {
        title: editTitle,
        summary: editSummary,
        content_html: editContent,
        content: {},
        category_id: editCategoryId,
        tag_ids: editTagIds,
        is_published: editPublished,
      };
      if (!isNew && activeArticle) body.id = activeArticle.id;
      const res = await fetch(`${KB_URL}?endpoint=articles`, {
        method: isNew ? 'POST' : 'PUT',
        headers: authHeaders(true),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || 'Не удалось сохранить', variant: 'destructive' });
        return;
      }
      toast({ title: 'Статья сохранена' });
      await loadArticles();
      const id = isNew ? data.id : activeArticle?.id;
      if (id) await openArticle(id);
    } catch {
      toast({ title: 'Ошибка соединения', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteArticle = async () => {
    if (!activeArticle) return;
    if (!window.confirm('Удалить статью? Это действие необратимо.')) return;
    const res = await fetch(`${KB_URL}?endpoint=articles&id=${activeArticle.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) {
      toast({ title: 'Статья удалена' });
      setActiveArticle(null);
      setMode('list');
      await loadArticles();
    }
  };

  const toggleLike = async () => {
    if (!activeArticle) return;
    const res = await fetch(`${KB_URL}?endpoint=like`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ article_id: activeArticle.id }),
    });
    if (res.ok) {
      const d = await res.json();
      setActiveArticle({ ...activeArticle, is_liked: d.liked, likes_count: d.likes_count });
    }
  };

  const toggleFavorite = async () => {
    if (!activeArticle) return;
    const res = await fetch(`${KB_URL}?endpoint=favorite`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ article_id: activeArticle.id }),
    });
    if (res.ok) {
      const d = await res.json();
      setActiveArticle({ ...activeArticle, is_favorite: d.is_favorite });
    }
  };

  const handleAddComment = async () => {
    if (!activeArticle || !newComment.trim()) return;
    const res = await fetch(`${KB_URL}?endpoint=comments`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ article_id: activeArticle.id, content: newComment }),
    });
    if (res.ok) {
      setNewComment('');
      const cr = await fetch(`${KB_URL}?endpoint=comments&article_id=${activeArticle.id}`, {
        headers: authHeaders(),
      });
      if (cr.ok) setComments(await cr.json());
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!activeArticle) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const res = await fetch(`${KB_URL}?endpoint=files`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          article_id: activeArticle.id,
          filename: file.name,
          mime_type: file.type,
          content_base64: base64,
        }),
      });
      if (res.ok) {
        toast({ title: 'Файл загружен' });
        await openArticle(activeArticle.id);
      } else {
        const e = await res.json();
        toast({ title: e.error || 'Ошибка загрузки', variant: 'destructive' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteFile = async (fid: number) => {
    if (!activeArticle) return;
    if (!window.confirm('Удалить файл?')) return;
    const res = await fetch(`${KB_URL}?endpoint=files&id=${fid}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) await openArticle(activeArticle.id);
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const res = await fetch(`${KB_URL}?endpoint=categories`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ name: newCatName, parent_id: newCatParent }),
    });
    if (res.ok) {
      setNewCatName('');
      setNewCatParent(null);
      await loadCategories();
      toast({ title: 'Категория создана' });
    }
  };

  const handleDeleteCategory = async (cid: number) => {
    if (!window.confirm('Удалить категорию? Статьи внутри останутся без категории.')) return;
    const res = await fetch(`${KB_URL}?endpoint=categories&id=${cid}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (res.ok) {
      await loadCategories();
      if (filterCategory === cid) setFilterCategory(null);
    }
  };

  const handleCreateTag = async () => {
    const name = window.prompt('Название тега:');
    if (!name) return;
    const res = await fetch(`${KB_URL}?endpoint=tags`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ name }),
    });
    if (res.ok) await loadTags();
  };

  const categoryTree = useMemo(() => {
    const map = new Map<number, Category & { children: Category[] }>();
    categories.forEach((c) => map.set(c.id, { ...c, children: [] }));
    const roots: (Category & { children: Category[] })[] = [];
    map.forEach((c) => {
      if (c.parent_id && map.has(c.parent_id)) {
        map.get(c.parent_id)!.children.push(c);
      } else {
        roots.push(c);
      }
    });
    return roots;
  }, [categories]);

  const sortedArticles = useMemo(() => {
    const list = [...articles];
    if (sortBy === 'popular') {
      list.sort(
        (a, b) =>
          (b.views_count || 0) + (b.likes_count || 0) -
          ((a.views_count || 0) + (a.likes_count || 0)),
      );
    }
    return list;
  }, [articles, sortBy]);

  const isHome = !search.trim() && !filterCategory && !filterTag && !showFavorites && !showAllArticles && mode === 'list';

  if (!canRead) return null;

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto w-full h-full">
        {/* === Main === */}
        <main className="flex-1 min-w-0">
          {search.trim() || mode === 'list' ? (
            <KBArticleList
              search={search}
              setSearch={setSearch}
              searchResults={searchResults}
              articles={sortedArticles}
              loading={loading}
              canWrite={canWrite}
              showFavorites={showFavorites}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              filterTag={filterTag}
              setFilterTag={setFilterTag}
              setShowFavorites={setShowFavorites}
              showAllArticles={showAllArticles}
              setShowAllArticles={setShowAllArticles}
              categories={categories}
              categoryTree={categoryTree}
              tags={tags}
              isHome={isHome}
              popular={popular}
              sortBy={sortBy}
              setSortBy={setSortBy}
              openArticle={openArticle}
              startNewArticle={startNewArticle}
            />
          ) : mode === 'view' && activeArticle ? (
            <KBArticleView
              activeArticle={activeArticle}
              comments={comments}
              newComment={newComment}
              setNewComment={setNewComment}
              canWrite={canWrite}
              setMode={setMode}
              toggleFavorite={toggleFavorite}
              toggleLike={toggleLike}
              startEditArticle={startEditArticle}
              handleDeleteArticle={handleDeleteArticle}
              handleAddComment={handleAddComment}
              handleUploadFile={handleUploadFile}
              handleDeleteFile={handleDeleteFile}
            />
          ) : (mode === 'edit' || mode === 'new') ? (
            <KBArticleEditor
              mode={mode}
              activeArticle={activeArticle}
              setMode={setMode}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              editSummary={editSummary}
              setEditSummary={setEditSummary}
              editContent={editContent}
              setEditContent={setEditContent}
              editCategoryId={editCategoryId}
              setEditCategoryId={setEditCategoryId}
              editTagIds={editTagIds}
              setEditTagIds={setEditTagIds}
              editPublished={editPublished}
              setEditPublished={setEditPublished}
              saving={saving}
              categories={categories}
              tags={tags}
              handleSaveArticle={handleSaveArticle}
            />
          ) : null}
        </main>
      </div>
    </PageLayout>
  );
};

export default KnowledgeBase;