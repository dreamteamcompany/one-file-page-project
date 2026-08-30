import { FN } from '@/config/backend';

export const TEMPLATES_URL = FN.REPLY_TEMPLATES;
export const IMPROVE_COMMENT_URL = FN.IMPROVE_COMMENT;

export const MAX_IMG_HEIGHT = 320;

export interface ReplyTemplate {
  id: number;
  title: string;
  content: string;
  is_shared: boolean;
}

/** Конвертирует File в data URL */
export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

/** Сериализует contenteditable → plain-text + markdown изображений */
export function serializeEditor(el: HTMLElement): string {
  let result = '';
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeName === 'BR') {
      result += '\n';
    } else if (node.nodeName === 'IMG') {
      const src = (node as HTMLImageElement).src;
      result += `\n![](${src})\n`;
    } else if (node.nodeName === 'DIV' || node.nodeName === 'P') {
      result += '\n' + serializeEditor(node as HTMLElement);
    } else {
      result += serializeEditor(node as HTMLElement);
    }
  });
  return result;
}
