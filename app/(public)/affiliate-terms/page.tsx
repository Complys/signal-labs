import React from "react";
import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Affiliate Terms and Conditions | Signal Labs",
  description:
    "Terms and conditions for the Signal Labs affiliate programme. Read before applying.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-black/75">{children}</div>
    </section>
  );
}

export default function AffiliateTermsPage() {
  return (
    <main className="min-h-screen bg-[#F6F8FB] text-[#0B1220]">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-black/10 bg-white shadow-sm p-6 sm:p-10">

          <h1 className="text-3xl font-semibold tracking-tight">
            Affiliate Terms and Conditions
          </h1>
          <p className="mt-2 text-sm text-black/50">
            Version: 2026-04-01. Read this document carefully before applying to the Signal Labs affiliate programme.
          </p>

          <div className="mt-6 rounded-2xl border border-black/10 bg-black/[0.02] p-5">
            <p className="text-sm font-semibold text-black/85">Important notice</p>
            <p className="mt-2 text-sm text-black/70">
              Signal Labs products are supplied strictly for <strong>laboratory and analytical research purposes only</strong>.
              They are not medicines and are not intended for human consumption. As an affiliate, you must
              reflect this in all promotional activity. Any breach of this requirement will result in
              immediate termination of your affiliate account.
            </p>
          </div>

          <Section title="1. The programme">
            <p>
              The Signal Labs affiliate programme allows approved individuals and organisations to earn
              commission by referring new customers to Signal Labs. Participation is subject to approval
              by Signal Labs and acceptance of these terms.
            </p>
            <p>
              By submitting an application, you confirm you have read and agree to these terms in full.
              Signal Labs reserves the right to accept or reject any application without providing a reason.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>To be eligible for the programme, you must:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Be aged 18 or over.</li>
              <li>Have a legitimate platform, website, or audience relevant to laboratory research, analytical science, or related fields.</li>
              <li>Agree to promote Signal Labs products honestly and in compliance with these terms.</li>
              <li>Provide valid identification when requesting a withdrawal.</li>
              <li>Not be located in a jurisdiction where participation in such a programme is prohibited.</li>
            </ul>
          </Section>

          <Section title="3. Prohibited conduct">
            <p>As an affiliate, you must not:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Make any medical, health, or therapeutic claims about Signal Labs products.</li>
              <li>Suggest or imply that products are suitable for human or veterinary consumption.</li>
              <li>Use misleading, deceptive, or exaggerated claims in any promotional material.</li>
              <li>Target audiences under the age of 18.</li>
              <li>Use spam, unsolicited messaging, or unethical traffic methods.</li>
              <li>Bid on Signal Labs brand keywords in paid search campaigns without prior written approval.</li>
              <li>Misrepresent your relationship with Signal Labs.</li>
              <li>Offer unauthorised discounts, cashback, or incentives beyond your referral link.</li>
            </ul>
            <p>
              All promotional content must clearly communicate that products are for research use only.
              Signal Labs may request to review your promotional material at any time.
            </p>
          </Section>

          <Section title="4. Referral tracking">
            <p>
              You will receive a unique referral code and link when your application is approved. Commission
              is tracked when a new customer places a paid order using your referral link or code.
            </p>
            <p>
              Referrals are tracked via cookies for 30 days from the customer's first click. If a customer
              clears their cookies or uses a different device, the referral may not be tracked.
            </p>
            <p>
              Commission is earned on new customers only. Repeat purchases by existing customers do not
              qualify for commission.
            </p>
          </Section>

          <Section title="5. Commission">
            <p>
              The default commission rate is <strong>10% of the net order value</strong> (excluding shipping).
              Signal Labs may offer a different rate to individual affiliates at its discretion.
            </p>
            <p>
              Commission is held in your affiliate wallet for <strong>30 days</strong> from the date of the
              qualifying order. This holding period allows for refunds and disputes to be resolved. If an
              order is refunded, the associated commission will be reversed.
            </p>
            <p>
              After 30 days, commission becomes available to withdraw, subject to the minimum withdrawal
              threshold of <strong>£25</strong>.
            </p>
          </Section>

          <Section title="6. Withdrawals">
            <p>
              To request a withdrawal, your available balance must be at least £25. You can submit a
              withdrawal request through your affiliate dashboard.
            </p>
            <p>When requesting a withdrawal, you must provide:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your full legal name.</li>
              <li>Your bank account details (account number and sort code).</li>
              <li>A valid form of photo identification (passport or driving licence).</li>
            </ul>
            <p>
              Signal Labs will process approved withdrawals by bank transfer. Withdrawals are reviewed
              manually and are typically processed within 5 business days of approval. Signal Labs reserves
              the right to request additional verification before processing any withdrawal.
            </p>
          </Section>

          <Section title="7. Taxes">
            <p>
              You are responsible for declaring and paying any tax on commission earned through the
              Signal Labs affiliate programme. Signal Labs does not deduct tax from payments and does not
              provide tax advice. If you are unsure of your obligations, consult a qualified tax adviser.
            </p>
          </Section>

          <Section title="8. Termination">
            <p>
              Signal Labs may suspend or terminate your affiliate account at any time if you breach these
              terms, engage in fraudulent activity, use misleading promotional methods, or bring Signal Labs
              into disrepute.
            </p>
            <p>
              On termination, any pending commission that has not yet passed the 30-day holding period will
              be forfeited. Available commission may be paid out at Signal Labs's discretion.
            </p>
            <p>
              You may close your affiliate account at any time by contacting support. Any available balance
              above £25 will be paid out on request.
            </p>
          </Section>

          <Section title="9. Liability">
            <p>
              Signal Labs is not liable for any loss of earnings, indirect loss, or consequential damage
              arising from participation in the affiliate programme, including changes to commission rates,
              product availability, or programme termination.
            </p>
            <p>
              You are solely responsible for the content you publish and any claims made in your promotional
              material. You agree to indemnify Signal Labs against any claims, losses, or costs arising from
              your breach of these terms.
            </p>
          </Section>

          <Section title="10. Changes to these terms">
            <p>
              Signal Labs may update these terms at any time. Continued participation in the programme
              after changes are published constitutes acceptance of the updated terms. We will notify
              active affiliates of material changes by email.
            </p>
          </Section>

          <Section title="11. Governing law">
            <p>
              These terms are governed by the laws of England and Wales. Any disputes will be subject
              to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </Section>

          <div className="mt-10 rounded-2xl border border-black/10 bg-black/[0.02] p-5">
            <p className="text-sm font-semibold text-black/85">Research use only</p>
            <p className="mt-2 text-sm text-black/70">
              All Signal Labs products are supplied strictly for laboratory and analytical research purposes.
              They are not medicines and are not intended for human or veterinary consumption. Affiliates
              must reflect this in all promotional activity.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/affiliates/apply" className="rounded-full bg-black text-white px-6 py-2.5 text-sm font-medium hover:opacity-90">
              Apply to the programme
            </a>
            <a href="/support" className="rounded-full border border-black/15 px-6 py-2.5 text-sm font-medium hover:bg-black/5">
              Contact support
            </a>
          </div>

          <p className="mt-8 text-xs text-black/40">
            Last updated: 1 April 2026. Signal Labs is a trading name registered in England and Wales.
          </p>

        </div>
      </div>
    </main>
  );
}
