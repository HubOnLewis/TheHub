import LegalPageLayout from './LegalPageLayout.js';

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="June 5, 2026">
      <section>
        <h2>Overview</h2>
        <p>
          This Privacy Policy describes how {`HuB on Lewis`} and its venue CRM platform collect, use, and protect
          information when you submit inquiries, request event proposals, communicate with our team, or use our
          website and client tools.
        </p>
      </section>

      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>
            <strong>Inquiry and contact data</strong> — name, email, phone, organization, event details, guest counts,
            dietary or accessibility notes, and messages you send through forms, email, or the client portal.
          </li>
          <li>
            <strong>Event and proposal data</strong> — dates, spaces, packages, contracts, payment milestones, and
            operational notes related to your booking.
          </li>
          <li>
            <strong>Analytics cookies</strong> — when enabled, we use privacy-conscious analytics (such as Google
            Analytics 4) to understand site usage, page views, and referral performance. You may control cookies through
            your browser settings.
          </li>
          <li>
            <strong>Referral tracking</strong> — if you arrive via a referral link, we may store a referral code in
            browser storage to attribute inquiries and measure program performance.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use information</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>Respond to inquiries and coordinate events</li>
          <li>Prepare, send, and manage proposals and contracts</li>
          <li>Process deposits and balances in accordance with your agreement</li>
          <li>Send operational updates and, where permitted, marketing communications</li>
          <li>Improve our services, venue operations, and client experience</li>
          <li>Measure referral and marketing program effectiveness</li>
        </ul>
      </section>

      <section>
        <h2>Marketing communications</h2>
        <p>
          With your consent or as permitted by law, we may send venue news, availability updates, or promotional offers.
          You may opt out at any time by using the unsubscribe link in marketing emails or by contacting us directly.
        </p>
      </section>

      <section>
        <h2>Sharing and retention</h2>
        <p>
          We do not sell personal information. We share data only with service providers who help us operate the venue
          and CRM (for example, payment processors, email platforms, or analytics tools) under appropriate safeguards.
          We retain information as needed to fulfill bookings, meet legal obligations, and resolve disputes.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <p>
          You may request access, correction, or deletion of your information, or opt out of marketing, by contacting us.
          We will respond within a reasonable timeframe.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          For privacy questions or requests, email our team using the contact address shown at the bottom of this page.
        </p>
      </section>
    </LegalPageLayout>
  );
}
