import { Link } from 'react-router-dom';
import { ROUTES } from '../config/paths.js';
import { useDemoOpsStore } from '../state/demoOpsStore.js';
import { getAgentEngineSnapshot } from '../agents/mockAgentEngine.js';

export default function DealAutopilotRail() {
  const deal = useDemoOpsStore(s => s.deal);
  const generateDealDraft = useDemoOpsStore(s => s.generateDealDraft);
  const queueDealDraftApproval = useDemoOpsStore(s => s.queueDealDraftApproval);
  const markDepositReminderQueued = useDemoOpsStore(s => s.markDepositReminderQueued);
  const completeDealNextAction = useDemoOpsStore(s => s.completeDealNextAction);
  const planRecommendation = useDemoOpsStore(s => s.planRecommendation);

  const rail = getAgentEngineSnapshot().dealRail;
  const draft = deal.activeDraft ?? rail.draftedClientMessage;

  return (
    <aside className="deal-autopilot-rail command-rail-sticky" aria-label="Autopilot copilot">
      <div className="deal-autopilot-rail__brand">
        <span className="deal-autopilot-rail__logo">HuB Autopilot</span>
        <Link to={ROUTES.autopilot} className="deal-autopilot-rail__link">
          Workforce
        </Link>
      </div>

      <section className="deal-autopilot-rail__section">
        <h3 className="deal-autopilot-rail__h">Recommended next action</h3>
        <p className="deal-autopilot-rail__body">
          {deal.nextActionComplete ? '✓ Cleared — Kisi path on track' : rail.recommendedNextAction}
        </p>
        {!deal.nextActionComplete ? (
          <button type="button" className="btn btn-secondary deal-autopilot-rail__btn" onClick={() => completeDealNextAction()}>
            Mark complete
          </button>
        ) : null}
      </section>

      <section className="deal-autopilot-rail__section">
        <h3 className="deal-autopilot-rail__h">AI draft</h3>
        <p className="deal-autopilot-rail__draft">{draft}</p>
        <div className="deal-autopilot-rail__hint">Queued locally — no send until approved.</div>
        <div className="deal-autopilot-rail__btn-row">
          <button type="button" className="btn btn-primary deal-autopilot-rail__btn" onClick={() => generateDealDraft()}>
            Generate draft
          </button>
          <button
            type="button"
            className="btn btn-secondary deal-autopilot-rail__btn"
            onClick={() => {
              navigator.clipboard?.writeText(deal.activeDraft ?? draft);
            }}
          >
            Copy
          </button>
          <button
            type="button"
            className="btn btn-secondary deal-autopilot-rail__btn"
            disabled={deal.draftQueued}
            onClick={() => queueDealDraftApproval()}
          >
            {deal.draftQueued ? 'Queued' : 'Queue for approval'}
          </button>
        </div>
      </section>

      <section className="deal-autopilot-rail__section">
        <h3 className="deal-autopilot-rail__h">Active automations</h3>
        <ul className="deal-autopilot-rail__autos">
          {rail.activeAutomations.map(x => {
            const dot =
              x.state === 'running'
                ? 'deal-autopilot-rail__dot--running'
                : x.state === 'awaiting_approval'
                  ? 'deal-autopilot-rail__dot--awaiting'
                  : 'deal-autopilot-rail__dot--paused';
            return (
              <li key={x.id}>
                <span className={`deal-autopilot-rail__dot ${dot}`} aria-hidden />
                <div>
                  <div className="deal-autopilot-rail__auto-title">{x.name}</div>
                  <div className="deal-autopilot-rail__auto-meta">
                    {x.agent} · {x.state.replace(/_/g, ' ')}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => planRecommendation('rec-miller')}>
          Mark upsell planned
        </button>
      </section>

      <section className="deal-autopilot-rail__section">
        <h3 className="deal-autopilot-rail__h">Deposit / balance</h3>
        <button
          type="button"
          className="btn btn-secondary deal-autopilot-rail__btn"
          disabled={deal.depositReminderQueued}
          onClick={() => markDepositReminderQueued()}
        >
          {deal.depositReminderQueued ? 'Reminder queued' : 'Mark deposit reminder queued'}
        </button>
      </section>

      <section className="deal-autopilot-rail__section">
        <h3 className="deal-autopilot-rail__h">Risk score explanation</h3>
        <p className="deal-autopilot-rail__body">{rail.riskScoreExplanation}</p>
      </section>

      <section className="deal-autopilot-rail__section">
        <h3 className="deal-autopilot-rail__h">Upsell recommendations</h3>
        <ul className="deal-autopilot-rail__upsell">
          {rail.upsellRecommendations.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
