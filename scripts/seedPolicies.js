import mongoose from "mongoose";
import dotenv from "dotenv";
import Policy from "../model/Policy.js";
import connectDB from "../config/db.js";

dotenv.config();

const defaultPolicies = {
  privacy: {
    type: "privacy",
    content: `<h2>1. Introduction</h2>
<p>Welcome to Zayan. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.</p>

<h2>2. Information We Collect</h2>
<p>We collect information that you provide directly to us, including:</p>
<ul>
  <li>Account information (name, email, password)</li>
  <li>Profile information (address, phone, preferences)</li>
  <li>Transaction information</li>
  <li>Communication data</li>
</ul>

<h2>3. How We Use Information</h2>
<p>We use the information we collect to:</p>
<ul>
  <li>Provide and maintain our services</li>
  <li>Process transactions</li>
  <li>Send you updates and notifications</li>
  <li>Improve our platform</li>
</ul>

<h2>4. Data Sharing & Disclosure</h2>
<p>We do not sell your personal information. We may share information with:</p>
<ul>
  <li>Service providers who assist us</li>
  <li>Legal authorities when required</li>
  <li>Business partners with your consent</li>
</ul>

<h2>5. Cookies & Tracking Technologies</h2>
<p>We use cookies to enhance your experience. See our Cookie Policy for details.</p>

<h2>6. User Rights & Choices</h2>
<p>You have the right to:</p>
<ul>
  <li>Access your personal data</li>
  <li>Correct inaccurate data</li>
  <li>Request deletion of your data</li>
  <li>Opt-out of marketing communications</li>
</ul>

<h2>7. Data Security</h2>
<p>We implement appropriate security measures to protect your information.</p>

<h2>8. International Users</h2>
<p>Your information may be transferred to and processed in countries other than your own.</p>

<h2>9. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. We will notify you of any changes.</p>

<h2>10. Contact Information</h2>
<p>If you have questions about this Privacy Policy, please contact us at support@zayan.com</p>`,
    version: "1.0.0",
    lastUpdated: new Date(),
  },
  terms: {
    type: "terms",
    content: `<h2>1. Acceptance of Terms</h2>
<p>By accessing or using Zayan, you agree to be bound by these Terms of Service.</p>

<h2>2. Platform Overview</h2>
<p>Zayan is a dual-platform marketplace offering both E-commerce and Real Estate services.</p>

<h2>3. User Accounts & Roles</h2>
<p>Users can have multiple roles:</p>
<ul>
  <li>E-commerce Buyer</li>
  <li>E-commerce Seller</li>
  <li>Real Estate Buyer</li>
  <li>Real Estate Seller</li>
</ul>

<h2>4. E-commerce Marketplace Terms</h2>
<p>When using our e-commerce platform:</p>
<ul>
  <li>Sellers must provide accurate product information</li>
  <li>Buyers must complete transactions in good faith</li>
  <li>All transactions are subject to our payment policies</li>
</ul>

<h2>5. Real Estate Marketplace Terms</h2>
<p>When using our real estate platform:</p>
<ul>
  <li>Listings must be accurate and current</li>
  <li>Agents must be properly licensed where required</li>
  <li>All property information must be truthful</li>
</ul>

<h2>6. Listings & Content Rules</h2>
<p>Users agree not to post:</p>
<ul>
  <li>False or misleading information</li>
  <li>Illegal or prohibited content</li>
  <li>Content that violates intellectual property rights</li>
</ul>

<h2>7. Payments, Fees & Commissions</h2>
<p>Fees and commissions are clearly disclosed before transactions. All payments are processed securely.</p>

<h2>8. Reviews & User Conduct</h2>
<p>Users must:</p>
<ul>
  <li>Provide honest and fair reviews</li>
  <li>Respect other users</li>
  <li>Follow community guidelines</li>
</ul>

<h2>9. Intellectual Property</h2>
<p>All content on Zayan is protected by intellectual property laws. Users retain rights to their own content.</p>

<h2>10. Termination & Suspension</h2>
<p>We reserve the right to suspend or terminate accounts that violate these terms.</p>

<h2>11. Disclaimers & Limitation of Liability</h2>
<p>Zayan is provided "as is" without warranties. We are not liable for user-to-user transactions.</p>

<h2>12. Governing Law & Dispute Resolution</h2>
<p>These terms are governed by the laws of Pakistan. Disputes will be resolved through arbitration.</p>

<h2>13. Changes to Terms</h2>
<p>We may update these terms from time to time. Continued use constitutes acceptance.</p>

<h2>14. Contact Information</h2>
<p>For questions about these terms, contact us at support@zayan.com</p>`,
    version: "1.0.0",
    lastUpdated: new Date(),
  },
  cookies: {
    type: "cookies",
    content: `<h2>1. What Are Cookies</h2>
<p>Cookies are small text files stored on your device when you visit our website.</p>

<h2>2. Types of Cookies We Use</h2>
<p>We use several types of cookies:</p>
<ul>
  <li>Essential cookies</li>
  <li>Analytics cookies</li>
  <li>Functional cookies</li>
  <li>Third-party cookies</li>
</ul>

<h2>3. Essential Cookies</h2>
<p>These cookies are necessary for the website to function properly. They cannot be disabled.</p>

<h2>4. Analytics & Performance Cookies</h2>
<p>These cookies help us understand how visitors interact with our website.</p>

<h2>5. Functional Cookies</h2>
<p>These cookies enable enhanced functionality and personalization.</p>

<h2>6. Third-Party Cookies</h2>
<p>We may use third-party services that set their own cookies.</p>

<h2>7. Managing Cookie Preferences</h2>
<p>You can manage cookie preferences through your browser settings or our cookie consent tool.</p>

<h2>8. Updates to This Policy</h2>
<p>We may update this Cookie Policy from time to time. Please review it periodically.</p>`,
    version: "1.0.0",
    lastUpdated: new Date(),
  },
};

async function seedPolicies() {
  try {
    await connectDB();
    console.log("Connected to database");

    for (const [type, policyData] of Object.entries(defaultPolicies)) {
      const existing = await Policy.findOne({ type });
      if (existing) {
        console.log(`Policy "${type}" already exists, skipping...`);
        continue;
      }

      await Policy.create(policyData);
      console.log(`✓ Created ${type} policy`);
    }

    console.log("\n✅ All policies seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding policies:", error);
    process.exit(1);
  }
}

seedPolicies();

