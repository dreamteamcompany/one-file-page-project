import { useMemo } from 'react';
import Icon from '@/components/ui/icon';
import { formatDateOnlyMSK, formatTimeMSK } from '@/utils/dateFormat';

interface CommentAttachment {
  id: number;
  filename: string;
  url: string;
  size: number;
}

interface CommentLite {
  id: number;
  user_id: number;
  user_name?: string;
  user_full_name?: string;
  user_photo_url?: string;
  created_at?: string;
  attachments?: CommentAttachment[];
}

interface TicketFilesProps {
  comments: CommentLite[];
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-purple-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
];
const getAvatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

const getInitials = (name?: string) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const formatSize = (size: number): string => {
  if (!size) return '';
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} МБ`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} ГБ`;
};

const formatDateGroup = (iso?: string) => formatDateOnlyMSK(iso, { longMonth: true, withYear: true }) || 'Без даты';

const formatTime = (iso?: string) => formatTimeMSK(iso);

const isImage = (filename: string) => /\.(jpe?g|png|gif|webp|svg|bmp|heic|heif)$/i.test(filename);

const getFileIcon = (filename: string): { name: string; color: string } => {
  const lower = filename.toLowerCase();
  if (/\.(pdf)$/.test(lower)) return { name: 'FileText', color: 'text-red-500' };
  if (/\.(docx?|odt|rtf)$/.test(lower)) return { name: 'FileText', color: 'text-blue-500' };
  if (/\.(xlsx?|ods|csv)$/.test(lower)) return { name: 'FileSpreadsheet', color: 'text-emerald-500' };
  if (/\.(pptx?|odp)$/.test(lower)) return { name: 'FileText', color: 'text-orange-500' };
  if (/\.(zip|rar|7z|tar|gz)$/.test(lower)) return { name: 'FileArchive', color: 'text-amber-500' };
  if (/\.(mp4|mov|avi|mkv|webm)$/.test(lower)) return { name: 'FileVideo', color: 'text-purple-500' };
  if (/\.(mp3|wav|ogg|flac|m4a)$/.test(lower)) return { name: 'FileAudio', color: 'text-pink-500' };
  if (/\.(txt|md|log)$/.test(lower)) return { name: 'FileText', color: 'text-muted-foreground' };
  if (/\.(json|xml|yaml|yml)$/.test(lower)) return { name: 'FileCode', color: 'text-cyan-500' };
  return { name: 'File', color: 'text-muted-foreground' };
};

interface FileItem {
  attachment: CommentAttachment;
  comment: CommentLite;
}

interface DateGroup {
  dayKey: string;
  dayLabel: string;
  files: FileItem[];
}

interface AuthorGroup {
  userId: number;
  userName: string;
  userPhotoUrl?: string;
  totalFiles: number;
  byDate: DateGroup[];
}

const TicketFiles = ({ comments }: TicketFilesProps) => {
  const authorGroups = useMemo<AuthorGroup[]>(() => {
    const allFiles: FileItem[] = [];
    comments.forEach((c) => {
      (c.attachments || []).forEach((a) => allFiles.push({ attachment: a, comment: c }));
    });

    allFiles.sort((a, b) => {
      const ta = a.comment.created_at ? new Date(a.comment.created_at).getTime() : 0;
      const tb = b.comment.created_at ? new Date(b.comment.created_at).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return b.attachment.id - a.attachment.id;
    });

    const byAuthor = new Map<number, AuthorGroup>();
    for (const item of allFiles) {
      const uid = item.comment.user_id;
      if (!byAuthor.has(uid)) {
        byAuthor.set(uid, {
          userId: uid,
          userName: item.comment.user_full_name || item.comment.user_name || 'Пользователь',
          userPhotoUrl: item.comment.user_photo_url,
          totalFiles: 0,
          byDate: [],
        });
      }
      const author = byAuthor.get(uid)!;
      author.totalFiles += 1;

      const dayKey = item.comment.created_at
        ? new Date(item.comment.created_at).toISOString().slice(0, 10)
        : 'unknown';
      let dayGroup = author.byDate.find((d) => d.dayKey === dayKey);
      if (!dayGroup) {
        dayGroup = {
          dayKey,
          dayLabel: formatDateGroup(item.comment.created_at),
          files: [],
        };
        author.byDate.push(dayGroup);
      }
      dayGroup.files.push(item);
    }

    const list = Array.from(byAuthor.values());
    list.forEach((a) => {
      a.byDate.sort((x, y) => (x.dayKey < y.dayKey ? 1 : x.dayKey > y.dayKey ? -1 : 0));
    });
    list.sort((a, b) => {
      const ta = new Date(a.byDate[0]?.files[0]?.comment.created_at || 0).getTime();
      const tb = new Date(b.byDate[0]?.files[0]?.comment.created_at || 0).getTime();
      return tb - ta;
    });
    return list;
  }, [comments]);

  const totalFiles = authorGroups.reduce((s, a) => s + a.totalFiles, 0);

  if (totalFiles === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Icon name="FileText" size={48} className="mx-auto mb-2 opacity-30" />
        <p>Файлы пока не загружены</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {authorGroups.map((author) => (
        <div key={author.userId} className="space-y-3">
          <div className="flex items-center gap-2">
            {author.userPhotoUrl ? (
              <img
                src={author.userPhotoUrl}
                alt={author.userName}
                className="w-7 h-7 rounded-full object-cover"
              />
            ) : (
              <div
                className={`w-7 h-7 rounded-full ${getAvatarColor(author.userId)} flex items-center justify-center text-white text-[11px] font-bold`}
              >
                {getInitials(author.userName)}
              </div>
            )}
            <p className="text-sm font-semibold">{author.userName}</p>
            <span className="text-xs text-muted-foreground">
              · {author.totalFiles} {author.totalFiles === 1 ? 'файл' : 'файлов'}
            </span>
          </div>

          <div className="space-y-4 pl-2 border-l-2 border-border">
            {author.byDate.map((day) => (
              <div key={day.dayKey} className="space-y-2 pl-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                  {day.dayLabel}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {day.files.map(({ attachment, comment }) => {
                    const img = isImage(attachment.filename);
                    const icon = getFileIcon(attachment.filename);
                    return (
                      <a
                        key={attachment.id}
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-attachment-link
                        className="group rounded-lg border bg-card hover:bg-accent transition-colors overflow-hidden flex flex-col"
                        title={attachment.filename}
                      >
                        <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
                          {img ? (
                            <img
                              src={attachment.url}
                              alt={attachment.filename}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          ) : (
                            <Icon name={icon.name} size={48} className={icon.color} />
                          )}
                        </div>
                        <div className="px-2 py-1.5 min-w-0">
                          <p className="text-xs truncate font-medium">{attachment.filename}</p>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <span className="text-[10px] text-muted-foreground">
                              {formatTime(comment.created_at)}
                            </span>
                            {attachment.size > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {formatSize(attachment.size)}
                              </span>
                            )}
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TicketFiles;