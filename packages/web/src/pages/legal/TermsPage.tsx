import LegalPageLayout from './LegalPageLayout.js';

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="June 5, 2026">
      <section>
        <h2>Agreement</h2>
        <p>
          By accessing this website, venue CRM tools, or submitting an event inquiry, you agree to these Terms of
          Service. If you do not agree, please do not use our services.
        </p>
      </section>

      <section>
        <h2>Use of the site and CRM</h2>
        <p>
          Our platform is provided for legitimate venue inquiries, event coordination, and client communication. You
          agree not to misuse the site, attempt unauthorized access, or interfere with venue operations or other users.
        </p>
      </section>

      <section>
        <h2>Event inquiries and proposals</h2>
        <p>
          Inquiry forms and proposal documents are for planning purposes. A proposal does not guarantee availability or
          a confirmed booking until a signed agreement and any required deposit are received and accepted by our team.
          Dates, pricing, and packages remain subject to change until finalized in writing.
        </p>
      </section>

      <section>
        <h2>Marketing communications</h2>
        <p>
          We may send operational messages related to your inquiry or event. Promotional communications are subject to
          applicable consent requirements and may be opted out of as described in our Privacy Policy.
        </p>
      </section>

      <section>
        <h2>Referral program</h2>
        <p>
          Referral links and incentive terms (cash, discounts, or custom rewards) are configurable and subject to
          separate program rules and business approval. Payouts are not automatic and require explicit program activation.
          Referral attribution is measured for reporting; actual rewards are issued only under approved terms.
        </p>
      </section>

      <section>
        <h2>No guarantee of booking</h2>
        <p>
          Venue availability, staffing, and final event execution depend on operational capacity, permitting, and
          contractual confirmation. We make no guarantee of booking until your event is formally confirmed by our team.
        </p>
      </section>

      <section>
        <h2>Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, {`HuB on Lewis`} and its operators are not liable for indirect,
          incidental, or consequential damages arising from use of this site or CRM tools. Our total liability for
          direct damages is limited to amounts you have paid us for the specific event or service giving rise to the
          claim, except where prohibited by law.
        </p>
      </section>

      <section>
        <h2>Changes</h2>
        <p>
          We may update these terms from time to time. Continued use after changes constitutes acceptance of the revised
          terms. Material changes will be reflected by an updated date at the top of this page.
        </p>
      </section>
    </LegalPageLayout>
  );
}
