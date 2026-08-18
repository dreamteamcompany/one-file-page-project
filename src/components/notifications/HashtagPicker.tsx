import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';

export interface Hashtag {
  tag: string;
  label: string;
  example: string;
}

interface HashtagPickerProps {
  hashtags: Hashtag[];
  onPick: (tag: string) => void;
}

const HashtagPicker = ({ hashtags, onPick }: HashtagPickerProps) => (
  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
      <Icon name="Hash" size={13} />
      Нажмите на хэштег — он вставится в текст и подставит данные заявки
    </p>
    <div className="flex flex-wrap gap-1.5">
      {hashtags.map((h) => (
        <Badge
          key={h.tag}
          variant="outline"
          title={`${h.label} — например: ${h.example}`}
          onClick={() => onPick(h.tag)}
          className="cursor-pointer font-normal hover:bg-primary/10 hover:text-primary hover:border-primary/40 transition-colors"
        >
          {h.tag}
        </Badge>
      ))}
    </div>
  </div>
);

export default HashtagPicker;
