import { isScreenshotMode } from '../config/screenshotMode.js';

/** Subtle client-review context — no scary dev warnings. */
export default function ClientReviewBanner({ variant = 'compact' }: { variant?: 'compact' | 'full' }) {
  if (!isScreenshotMode()) return null;

  if (variant === 'full') {
    return (
      <div className="client-review-banner client-review-banner--full" role="note">
        <span className="client-review-banner__tag">Client review mode</span>
        <p>
          Suggested edits captured here will guide the next build pass. This is a demo environment: no live emails,
          payments, or automations are sent.
        </p>
      </div>
    );
  }

  return (
    <div className="client-review-banner" role="note">
      <span className="client-review-banner__tag">Client review mode</span>
      <span className="client-review-banner__text">
        Demo environment — no live emails, payments, or automations are sent.
      </span>
    </div>
  );
}
