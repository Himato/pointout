import { h } from './dom';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyWithTextarea(text);
  }
}

// For http pages and browsers that refuse the async clipboard.
function copyWithTextarea(text: string): boolean {
  const previousFocus = document.activeElement;
  const area = h('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  Object.assign(area.style, { position: 'fixed', top: '0', left: '0', opacity: '0' });
  document.body.append(area);
  area.select();
  try {
    // Deprecated, yet still the only fallback that works when the async clipboard is refused.
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  }
}

/** Saves a file through a throwaway link that lives in `parent`, so our own hit test ignores it. */
export function downloadFile(
  parent: HTMLElement,
  filename: string,
  contents: string,
  type: string,
): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = h('a');
  link.href = url;
  link.download = filename;
  parent.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
