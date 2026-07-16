import { $getSelectionStyleValueForProperty } from '@lexical/selection';
import { $getSelection, $isRangeSelection } from 'lexical';

export const DEFAULT_FONT_SIZE = 16;
export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 48;
export const FONT_SIZE_STEP = 2;

/** Must be called within an editor read/update context. */
export function $readFontSize(): number {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return DEFAULT_FONT_SIZE;
  const value = $getSelectionStyleValueForProperty(
    selection,
    'font-size',
    `${DEFAULT_FONT_SIZE}px`,
  );
  return Number.parseInt(value, 10) || DEFAULT_FONT_SIZE;
}
