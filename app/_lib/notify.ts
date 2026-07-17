import { headers } from 'next/headers';
import { sdk } from '@sovereignfs/sdk';
import type { SendNotificationInput } from '@sovereignfs/sdk';

/**
 * Sends a notification to a user. Best-effort: a failure here (e.g. the
 * platform notification center being briefly unavailable) must never block
 * the membership change that triggered it, which already succeeded by the
 * time we notify about it.
 *
 * `sdk.notifications.send` reads the calling plugin's id from an explicitly
 * passed Headers object (unlike e.g. `sdk.auth`, which reads request headers
 * internally) — omitting it silently attributes the notification to
 * "unknown" instead of Tritext.
 */
export async function notifyUser(input: SendNotificationInput): Promise<void> {
  try {
    await sdk.notifications.send(input, await headers());
  } catch {
    // See docblock — never let a notification failure surface to the user.
  }
}
