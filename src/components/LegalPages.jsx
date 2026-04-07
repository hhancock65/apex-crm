import React from "react";

function LegalLayout({ title, lastUpdated, children, onBack }) {
  return (
    <div style={{ minHeight: "100vh", background: "#F5F5F4", fontFamily: "Inter, sans-serif" }}>
      <div style={{ background: "#0C1929", padding: "1.25rem 3rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
          Apex <span style={{ color: "#378ADD", fontWeight: 400 }}>CRM</span>
        </div>
        <button onClick={onBack} style={{ background: "transparent", border: "0.5px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.7)", padding: "6px 16px", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          ← Back
        </button>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 2rem" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: "#1A1917", letterSpacing: "-0.5px", marginBottom: 8 }}>{title}</h1>
        <p style={{ fontSize: 13, color: "#7A7875", marginBottom: "2rem" }}>Last updated: {lastUpdated}</p>
        <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: "2rem 2.5rem" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const S = {
  h2: { fontSize: 18, fontWeight: 600, color: "#1A1917", marginTop: "1.75rem", marginBottom: 8 },
  p:  { fontSize: 14, color: "#4A4846", lineHeight: 1.8, marginBottom: 12 },
  li: { fontSize: 14, color: "#4A4846", lineHeight: 1.8, marginBottom: 6 },
};

export function TermsPage({ onBack }) {
  return (
    <LegalLayout title="Terms of Service" lastUpdated="April 7, 2026" onBack={onBack}>
      <p style={S.p}>Please read these Terms of Service carefully before using Apex CRM. By accessing or using the service, you agree to be bound by these terms.</p>

      <h2 style={S.h2}>1. Acceptance of terms</h2>
      <p style={S.p}>By creating an account or using Apex CRM, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use the service.</p>

      <h2 style={S.h2}>2. Description of service</h2>
      <p style={S.p}>Apex CRM provides a cloud-based customer relationship management platform for small teams and businesses. Features include contact management, deal pipeline tracking, task management, and team collaboration tools.</p>

      <h2 style={S.h2}>3. Account registration</h2>
      <p style={S.p}>You must provide accurate, complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.</p>

      <h2 style={S.h2}>4. Subscription and billing</h2>
      <p style={S.p}>Apex CRM offers a 14-day free trial with no credit card required. After the trial, continued use requires a paid subscription. Subscriptions are billed monthly. You may cancel at any time. No refunds are provided for partial months.</p>
      <ul style={{ paddingLeft: "1.5rem", marginBottom: 12 }}>
        <li style={S.li}>Starter plan: $29/month — up to 2 users, 500 contacts</li>
        <li style={S.li}>Pro plan: $99/month — unlimited users and contacts</li>
      </ul>
      <p style={S.p}>Payments are processed securely by Stripe. We do not store your payment card information.</p>

      <h2 style={S.h2}>5. Data ownership</h2>
      <p style={S.p}>You retain full ownership of all data you enter into Apex CRM. We do not sell, share, or use your business data for any purpose other than providing the service.</p>

      <h2 style={S.h2}>6. Acceptable use</h2>
      <p style={S.p}>You agree not to use Apex CRM to:</p>
      <ul style={{ paddingLeft: "1.5rem", marginBottom: 12 }}>
        <li style={S.li}>Violate any applicable laws or regulations</li>
        <li style={S.li}>Transmit spam or unsolicited communications</li>
        <li style={S.li}>Attempt to gain unauthorized access to any part of the service</li>
        <li style={S.li}>Interfere with or disrupt the service or servers</li>
      </ul>

      <h2 style={S.h2}>7. Service availability</h2>
      <p style={S.p}>We strive for 99.9% uptime but do not guarantee uninterrupted access. We may perform maintenance that temporarily affects availability. We will provide advance notice where possible.</p>

      <h2 style={S.h2}>8. Termination</h2>
      <p style={S.p}>You may cancel your account at any time. We reserve the right to suspend or terminate accounts that violate these terms. Upon termination, you may export your data within 30 days.</p>

      <h2 style={S.h2}>9. Limitation of liability</h2>
      <p style={S.p}>To the fullest extent permitted by law, Apex CRM shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability shall not exceed the amount you paid in the 12 months preceding the claim.</p>

      <h2 style={S.h2}>10. Changes to terms</h2>
      <p style={S.p}>We may update these terms from time to time. We will notify you via email of material changes. Continued use of the service after changes constitutes acceptance of the new terms.</p>

      <h2 style={S.h2}>11. Contact</h2>
      <p style={S.p}>Questions about these terms? Contact us at legal@apexcrm.com</p>
    </LegalLayout>
  );
}

export function PrivacyPage({ onBack }) {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="April 7, 2026" onBack={onBack}>
      <p style={S.p}>Your privacy is important to us. This policy explains how Apex CRM collects, uses, and protects your information.</p>

      <h2 style={S.h2}>1. Information we collect</h2>
      <p style={S.p}>We collect information you provide directly:</p>
      <ul style={{ paddingLeft: "1.5rem", marginBottom: 12 }}>
        <li style={S.li}>Account information: name, email address, username, company name</li>
        <li style={S.li}>CRM data: contacts, deals, tasks, and notes you create</li>
        <li style={S.li}>Billing information: processed securely by Stripe (we never see your card details)</li>
      </ul>
      <p style={S.p}>We also collect limited technical information automatically: IP address, browser type, and usage patterns to improve the service.</p>

      <h2 style={S.h2}>2. How we use your information</h2>
      <ul style={{ paddingLeft: "1.5rem", marginBottom: 12 }}>
        <li style={S.li}>To provide and maintain the Apex CRM service</li>
        <li style={S.li}>To send transactional emails (confirmation, billing receipts, trial reminders)</li>
        <li style={S.li}>To process payments and manage subscriptions</li>
        <li style={S.li}>To respond to support requests</li>
        <li style={S.li}>To improve the product based on usage patterns</li>
      </ul>
      <p style={S.p}>We do not sell your data. We do not use your business data for advertising.</p>

      <h2 style={S.h2}>3. Data storage and security</h2>
      <p style={S.p}>Your data is stored in Supabase (PostgreSQL) with row-level security ensuring each organization can only access their own data. All data is encrypted in transit (TLS) and at rest. We use industry-standard security practices.</p>

      <h2 style={S.h2}>4. Data sharing</h2>
      <p style={S.p}>We share your data only with essential service providers:</p>
      <ul style={{ paddingLeft: "1.5rem", marginBottom: 12 }}>
        <li style={S.li}>Supabase — database and authentication</li>
        <li style={S.li}>Stripe — payment processing</li>
        <li style={S.li}>Resend — transactional email delivery</li>
        <li style={S.li}>Vercel — hosting and infrastructure</li>
      </ul>
      <p style={S.p}>All providers are contractually bound to protect your data and may not use it for their own purposes.</p>

      <h2 style={S.h2}>5. Your rights</h2>
      <p style={S.p}>You have the right to:</p>
      <ul style={{ paddingLeft: "1.5rem", marginBottom: 12 }}>
        <li style={S.li}>Access all data we hold about you</li>
        <li style={S.li}>Export your data at any time (CSV export available in the app)</li>
        <li style={S.li}>Delete your account and all associated data</li>
        <li style={S.li}>Correct inaccurate information</li>
      </ul>

      <h2 style={S.h2}>6. Cookies</h2>
      <p style={S.p}>We use only essential cookies required for authentication and session management. We do not use tracking or advertising cookies.</p>

      <h2 style={S.h2}>7. Data retention</h2>
      <p style={S.p}>We retain your data for as long as your account is active. When you cancel, you have 30 days to export your data before it is permanently deleted.</p>

      <h2 style={S.h2}>8. Children's privacy</h2>
      <p style={S.p}>Apex CRM is not intended for users under 18. We do not knowingly collect data from minors.</p>

      <h2 style={S.h2}>9. Changes to this policy</h2>
      <p style={S.p}>We will notify you by email of any material changes to this policy at least 30 days before they take effect.</p>

      <h2 style={S.h2}>10. Contact</h2>
      <p style={S.p}>Privacy questions? Contact us at privacy@apexcrm.com</p>
    </LegalLayout>
  );
}
