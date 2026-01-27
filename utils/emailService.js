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
    from,
    subject,
  };

  if (text && text.trim().length > 0) {
    msg.text = text;
  }

  if (html && html.trim().length > 0) {
    msg.html = html;
  } else if (text && text.trim().length > 0) {
    // Fallback to text if html is empty
    msg.html = text;
  }

  if (!msg.text && !msg.html) {
    console.error("❌ Cannot send email: No content (text or html) provided");
    throw new Error(
      "Email content (text or html) must be at least one character in length.",
    );
  }

  try {
    const response = await sgMail.send(msg);
    return response;
  } catch (error) {
    console.error("❌ Error sending email via SendGrid:", error);
    if (error.response) {
      console.error(JSON.stringify(error.response.body, null, 2));
    }
    throw error;
  }
};

export default sendEmail;
