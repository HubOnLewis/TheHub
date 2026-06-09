/** Subtle trust copy — actions queue locally; no scary “demo-only” on every control */
export default function OpsTrustStrip({ dense = false }: { dense?: boolean }) {
  return (
    <div className={`ops-trust-strip${dense ? ' ops-trust-strip--dense' : ''}`} role="note">
      <span className="ops-trust-strip__dot" aria-hidden />
      <span>
        Actions update locally and queue for approval — no live emails, payments, or external automations are sent.
      </span>
    </div>
  );
}
