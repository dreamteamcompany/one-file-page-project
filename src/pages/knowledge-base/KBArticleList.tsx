import { Dispatch, SetStateAction } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { ArticleListItem, Category, Tag } from './types';

interface KBArticleListProps {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  searchResults: ArticleListItem[];
  articles: ArticleListItem[];
  loading: boolean;
  canWrite: boolean;
  showFavorites: boolean;
  filterCategory: number | null;
  setFilterCategory: Dispatch<SetStateAction<number | null>>;
  filterTag: number | null;
  setFilterTag: Dispatch<SetStateAction<number | null>>;
  setShowFavorites: Dispatch<SetStateAction<boolean>>;
  showAllArticles: boolean;
  setShowAllArticles: Dispatch<SetStateAction<boolean>>;
  categories: Category[];
  categoryTree: (Category & { children: Category[] })[];
  tags: Tag[];
  isHome: boolean;
  popular: ArticleListItem[];
  sortBy: 'new' | 'popular';
  setSortBy: Dispatch<SetStateAction<'new' | 'popular'>>;
  openArticle: (id: number) => void;
  startNewArticle: () => void;
}

const FOLDER_IMG = 'https://cdn.poehali.dev/projects/1bde8275-3fbd-44e1-b7ff-9b0123cbb82a/bucket/6e5d7c73-caf8-44d3-a2b2-983f5af9a95b.png';

// Палитра пастельных плашек для иконок категорий статей.
const ICON_PALETTES = [
  { bg: 'bg-violet-100 dark:bg-violet-950/40', fg: 'text-violet-600 dark:text-violet-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-950/40', fg: 'text-emerald-600 dark:text-emerald-300' },
  { bg: 'bg-blue-100 dark:bg-blue-950/40', fg: 'text-blue-600 dark:text-blue-300' },
  { bg: 'bg-pink-100 dark:bg-pink-950/40', fg: 'text-pink-600 dark:text-pink-300' },
  { bg: 'bg-amber-100 dark:bg-amber-950/40', fg: 'text-amber-600 dark:text-amber-300' },
  { bg: 'bg-cyan-100 dark:bg-cyan-950/40', fg: 'text-cyan-600 dark:text-cyan-300' },
];

const paletteFor = (id: number) => ICON_PALETTES[id % ICON_PALETTES.length];

// Примерное время чтения (заглушка): по summary/длине заголовка.
const readingTime = (a: ArticleListItem): number => {
  const len = (a.summary?.length || 0) + a.title.length;
  return Math.max(3, Math.round(len / 120) + 3);
};

// Большая премиальная карточка статьи (по эталону).
const ArticleCard = ({
  a,
  openArticle,
}: {
  a: ArticleListItem;
  openArticle: (id: number) => void;
}) => {
  const palette = paletteFor(a.category_id || a.id);
  return (
    <button
      onClick={() => openArticle(a.id)}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary/40"
    >
      <div className="mb-4 flex items-start justify-between">
        <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', palette.bg)}>
          <Icon name={a.category_color ? 'Phone' : 'FileText'} size={22} className={palette.fg} />
        </span>
        <Icon
          name="Bookmark"
          size={18}
          className={a.is_favorite ? 'fill-primary text-primary' : 'text-muted-foreground/50'}
        />
      </div>

      <h3 className="mb-3 line-clamp-3 text-base font-bold leading-snug text-foreground transition-colors group-hover:text-primary">
        {a.title}
      </h3>

      {a.category_name && (
        <span className={cn('mb-4 inline-flex w-fit rounded-md px-2 py-0.5 text-xs font-medium', palette.bg, palette.fg)}>
          {a.category_name}
        </span>
      )}

      <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Icon name="Eye" size={13} />
          {a.views_count}
        </span>
        <span className="flex items-center gap-1">
          <Icon name="Heart" size={13} className={a.is_liked ? 'fill-red-500 text-red-500' : ''} />
          {a.likes_count}
        </span>
        <span className="ml-auto">{readingTime(a)} мин чтения</span>
      </div>
    </button>
  );
};

const SECTION_ICONS = ['LayoutGrid', 'Star', 'FileText', 'ShieldCheck', 'Landmark'];
const SECTION_PALETTES = [
  { bg: 'bg-violet-100 dark:bg-violet-950/40', fg: 'text-violet-600 dark:text-violet-300' },
  { bg: 'bg-amber-100 dark:bg-amber-950/40', fg: 'text-amber-600 dark:text-amber-300' },
  { bg: 'bg-blue-100 dark:bg-blue-950/40', fg: 'text-blue-600 dark:text-blue-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-950/40', fg: 'text-emerald-600 dark:text-emerald-300' },
  { bg: 'bg-cyan-100 dark:bg-cyan-950/40', fg: 'text-cyan-600 dark:text-cyan-300' },
];

const FEATURES = [
  { icon: 'Zap', title: 'Быстрый поиск', text: 'Найдите нужную информацию за секунды', bg: 'bg-violet-100 dark:bg-violet-950/40', fg: 'text-violet-600 dark:text-violet-300' },
  { icon: 'Bookmark', title: 'Избранное', text: 'Сохраняйте важные статьи для себя', bg: 'bg-blue-100 dark:bg-blue-950/40', fg: 'text-blue-600 dark:text-blue-300' },
  { icon: 'ShieldCheck', title: 'Проверенная информация', text: 'Только актуальные и проверенные данные', bg: 'bg-emerald-100 dark:bg-emerald-950/40', fg: 'text-emerald-600 dark:text-emerald-300' },
  { icon: 'Bell', title: 'Уведомления', text: 'Будьте в курсе важных обновлений', bg: 'bg-amber-100 dark:bg-amber-950/40', fg: 'text-amber-600 dark:text-amber-300' },
];

const KBArticleList = ({
  search,
  setSearch,
  searchResults,
  articles,
  loading,
  canWrite,
  showFavorites,
  filterCategory,
  setFilterCategory,
  filterTag,
  setFilterTag,
  setShowFavorites,
  showAllArticles,
  setShowAllArticles,
  categories,
  categoryTree,
  tags,
  isHome,
  popular,
  sortBy,
  setSortBy,
  openArticle,
  startNewArticle,
}: KBArticleListProps) => {
  // === Search results ===
  if (search.trim()) {
    return (
      <Card>
        <CardContent className="p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Icon name="Search" size={18} />
            Результаты поиска
          </h2>
          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ничего не найдено</p>
          ) : (
            <ul className="space-y-2">
              {searchResults.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => {
                      setSearch('');
                      openArticle(a.id);
                    }}
                    className="w-full text-left p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <p className="font-medium">{a.title}</p>
                    {a.summary && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{a.summary}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {a.category_name && <span className="mr-2">{a.category_name}</span>}
                      <Icon name="Eye" size={10} className="inline mr-0.5" />
                      {a.views_count}
                      <Icon name="Heart" size={10} className="inline ml-2 mr-0.5" />
                      {a.likes_count}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    );
  }

  // === Home: премиальный дизайн help-центра ===
  if (isHome) {
    const totalCount = categories.reduce((s, c) => s + (c.articles_count || 0), 0) || articles.length;

    return (
      <div className="space-y-8">
        {/* Верхняя строка */}
        <div className="flex items-center justify-end gap-2">
          {canWrite && (
            <Button variant="outline" onClick={startNewArticle} className="gap-2 rounded-xl">
              <Icon name="PenLine" size={16} />
              Предложить статью
            </Button>
          )}
        </div>

        {/* Hero */}
        <div className="relative rounded-3xl bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <div className="relative z-10 max-w-2xl p-2 md:p-4">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">База знаний</h1>
            <p className="mt-3 text-base text-muted-foreground">
              Найдите ответ на любой вопрос или выберите нужный раздел
            </p>
            <div className="relative mt-6 max-w-xl">
              <Icon name="Search" size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Что вы ищете?"
                className="h-14 rounded-2xl border-border pl-12 pr-16 text-base shadow-sm"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
                ⌘K
              </span>
            </div>
          </div>
          <img
            src={FOLDER_IMG}
            alt=""
            style={{
              WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at center, black 45%, transparent 70%)',
              maskImage: 'radial-gradient(ellipse 60% 60% at center, black 45%, transparent 70%)',
            }}
            className="animate-float pointer-events-none absolute right-4 top-1/2 hidden max-h-[90%] w-64 select-none object-contain lg:block xl:w-72"
          />
        </div>

        {/* Карточки-разделы */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {/* Все статьи */}
          <SectionCard
            active={!filterCategory && !filterTag && !showFavorites}
            icon="LayoutGrid"
            label="Все статьи"
            count={totalCount}
            palette={SECTION_PALETTES[0]}
            onClick={() => { setFilterCategory(null); setFilterTag(null); setShowFavorites(false); }}
          />
          {/* Избранное */}
          <SectionCard
            active={showFavorites}
            icon="Star"
            label="Избранное"
            count={articles.filter((a) => a.is_favorite).length}
            palette={SECTION_PALETTES[1]}
            onClick={() => { setShowFavorites(true); setFilterCategory(null); setFilterTag(null); }}
          />
          {/* Категории */}
          {categories.slice(0, 3).map((c, i) => (
            <SectionCard
              key={c.id}
              active={filterCategory === c.id}
              icon={c.icon || SECTION_ICONS[(i + 2) % SECTION_ICONS.length]}
              label={c.name}
              count={c.articles_count}
              palette={SECTION_PALETTES[(i + 2) % SECTION_PALETTES.length]}
              iconColor={c.color || undefined}
              onClick={() => { setFilterCategory(c.id); setFilterTag(null); setShowFavorites(false); }}
            />
          ))}
          {/* Все теги */}
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-4 shadow-sm">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Icon name="Diamond" size={18} className="text-muted-foreground" />
              Все теги
            </span>
            <Icon name="ChevronDown" size={16} className="text-muted-foreground" />
          </div>
        </div>

        {/* Теги (компактно) */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button
                key={t.id}
                onClick={() => { setFilterTag(t.id); setFilterCategory(null); setShowFavorites(false); }}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                style={t.color ? { borderColor: t.color, color: t.color } : undefined}
              >
                #{t.name}
              </button>
            ))}
          </div>
        )}

        {/* Популярные статьи */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Популярные статьи</h2>
            <button
              onClick={() => {
                setSortBy('popular');
                setFilterCategory(null);
                setFilterTag(null);
                setShowFavorites(false);
                setShowAllArticles(true);
              }}
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Смотреть все
              <Icon name="ArrowRight" size={15} />
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : (popular.length ? popular : articles).length === 0 ? (
            <p className="text-sm text-muted-foreground">Статей пока нет</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {(popular.length ? popular : articles).slice(0, 4).map((a) => (
                <ArticleCard key={a.id} a={a} openArticle={openArticle} />
              ))}
            </div>
          )}
        </div>

        {/* Панель фич */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', f.bg)}>
                  <Icon name={f.icon} size={20} className={f.fg} />
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">{f.title}</div>
                  <div className="text-xs text-muted-foreground">{f.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // === Filtered list (category / tag / favorites) ===
  const title = showFavorites
    ? 'Избранное'
    : filterCategory
    ? categories.find((c) => c.id === filterCategory)?.name
    : filterTag
    ? `#${tags.find((t) => t.id === filterTag)?.name}`
    : showAllArticles
    ? 'Все статьи'
    : 'Статьи';

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div>
          <button
            onClick={() => {
              setFilterCategory(null);
              setFilterTag(null);
              setShowFavorites(false);
              setShowAllArticles(false);
            }}
            className="mb-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <Icon name="ChevronLeft" size={12} />
            База знаний
          </button>
          <h1 className="flex items-center gap-2 text-2xl font-bold">{title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {loading ? 'Загрузка...' : `${articles.length} ${articles.length === 1 ? 'статья' : 'статей'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-border">
            <button
              onClick={() => setSortBy('new')}
              className={cn('px-3 py-1.5 text-xs', sortBy === 'new' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
            >
              Новые
            </button>
            <button
              onClick={() => setSortBy('popular')}
              className={cn('px-3 py-1.5 text-xs', sortBy === 'popular' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
            >
              Популярные
            </button>
          </div>
          {canWrite && (
            <Button onClick={startNewArticle} className="gap-2">
              <Icon name="Plus" size={16} />
              Новая статья
            </Button>
          )}
        </div>
      </header>

      {articles.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Icon name="FileText" size={48} className="mx-auto mb-3 opacity-30" />
          <p>Статей пока нет</p>
          {canWrite && (
            <Button onClick={startNewArticle} variant="outline" className="mt-3 gap-2">
              <Icon name="Plus" size={14} />
              Создать первую
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} a={a} openArticle={openArticle} />
          ))}
        </div>
      )}
    </div>
  );
};

// Карточка-раздел в верхнем ряду.
const SectionCard = ({
  active,
  icon,
  label,
  count,
  palette,
  iconColor,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  count: number;
  palette: { bg: string; fg: string };
  iconColor?: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card',
    )}
  >
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
        active ? 'bg-white/20' : palette.bg,
      )}
    >
      <Icon name={icon} size={20} className={active ? 'text-primary-foreground' : palette.fg} style={!active && iconColor ? { color: iconColor } : undefined} />
    </span>
    <div className="min-w-0">
      <div className={cn('truncate text-sm font-semibold', active ? 'text-primary-foreground' : 'text-foreground')}>
        {label}
      </div>
      <div className={cn('text-xs', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
        {count} {count === 1 ? 'статья' : 'статей'}
      </div>
    </div>
  </button>
);

export default KBArticleList;