import { useEffect, useRef, useState, memo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/utils/api';
import { useImageLightbox } from '@/components/shared/ImageLightbox';
import { FN } from '@/config/backend';

const COMMENTS_API = FN.TICKET_COMMENTS;
const IMAGE_RE = /!\[([^\]]*)\]\((data:image\/[^;)]+;base64,[^\s)]+)\)/g;

const inlineCache = new Map<number, string>();

interface InlineCommentImageProps {
  commentId: number;
  alt?: string;
}

const InlineCommentImage = memo(({ commentId, alt = 'image' }: InlineCommentImageProps) => {
  const { token } = useAuth();
  const lightbox = useImageLightbox();
  const [src, setSrc] = useState<string | null>(() => inlineCache.get(commentId) || null);
  const [error, setError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (src) return;
    if (inlineCache.has(commentId)) {
      setSrc(inlineCache.get(commentId)!);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const response = await apiFetch(
          `${COMMENTS_API}?action=get-inline&comment_id=${commentId}`,
          {
            headers: { 'X-Auth-Token': token },
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const fullText: string = data.comment || '';

        const match = IMAGE_RE.exec(fullText);
        IMAGE_RE.lastIndex = 0;
        if (match) {
          const dataUrl = match[2];
          inlineCache.set(commentId, dataUrl);
          setSrc(dataUrl);
        } else {
          setError(true);
        }
      } catch (e) {
        if (!controller.signal.aborted) setError(true);
      }
    })();

    return () => controller.abort();
  }, [commentId, token, src]);

  if (error) {
    return (
      <span className="inline-block text-xs text-muted-foreground italic">
        [не удалось загрузить картинку]
      </span>
    );
  }

  if (!src) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        style={{ display: 'block', margin: '4px 0' }}
      >
        <span className="inline-block w-3 h-3 rounded-full border-2 border-muted-foreground border-t-transparent animate-spin" />
        Загрузка картинки…
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onClick={() => lightbox.open(src, alt)}
      style={{
        maxWidth: '100%',
        maxHeight: 400,
        borderRadius: 6,
        display: 'block',
        margin: '4px 0',
        cursor: 'pointer',
      }}
    />
  );
});

InlineCommentImage.displayName = 'InlineCommentImage';

export default InlineCommentImage;