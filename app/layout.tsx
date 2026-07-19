import type { ReactNode } from 'react';
import { fontFaceCss } from './_lib/fontFace';
import { registerPortabilityHandlers } from './_lib/portability';
import { listActiveFontsForFontFace } from './fonts-actions';

/**
 * Injects `@font-face` rules for every active custom webfont (Phase 8) —
 * purely additive, no wrapping element, so it can't affect any page's own
 * layout/spacing (each page already owns its own root `.page`-style div).
 */
export default async function TritextLayout({ children }: { children: ReactNode }) {
  // In-process and reset on restart — the platform SDK requires
  // re-registering from a request-scoped plugin route, so this runs on
  // every request. Best-effort: a registration failure must not block the
  // plugin's own UI (matches sovereign-tasks' layout.tsx).
  try {
    await registerPortabilityHandlers();
  } catch {
    // Portability is a best-effort platform integration.
  }

  let fonts: Awaited<ReturnType<typeof listActiveFontsForFontFace>> = [];
  try {
    fonts = await listActiveFontsForFontFace();
  } catch {
    // A font-listing failure must never block the whole plugin shell —
    // pages just render with system font fallbacks.
  }

  return (
    <>
      {fonts.length > 0 && <style>{fontFaceCss(fonts)}</style>}
      {children}
    </>
  );
}
