import sgMail from "@sendgrid/mail";
import dotenv from "dotenv";
dotenv.config();

// Use SENDGRID_API_KEY if available, otherwise try SENDGRID_APIKEY as requested by user
const apiKey = process.env.SENDGRID_API_KEY || process.env.SENDGRID_APIKEY;

if (!apiKey) {
  console.warn("⚠️ SENDGRID_API_KEY is not defined in environment variables");
} else {
  sgMail.setApiKey(apiKey);
}

// Default sender from existing config or fallback
const DEFAULT_SENDER = process.env.MAIL_USER || "maharalimoavia396@gmail.com";

/**
 * Send an email using SendGrid
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} [options.text] - Plain text content (optional)
 * @param {string} [options.from] - Sender email (optional, defaults to MAIL_USER)
 * @returns {Promise<Object>} - SendGrid response
 */
export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  from = DEFAULT_SENDER,
}) => {
  const msg = {
    to,
    from, // Change to your verified sender
    subject,
    text: text || "",
    html: html || text,
  };

  try {
    const response = await sgMail.send(msg);
    // console.log(`✅ Email sent to ${to}`);
    return response;
  } catch (error) {
    console.error("❌ Error sending email via SendGrid:", error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw error;
  }
};

export default sendEmail;
