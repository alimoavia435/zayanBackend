import { sendEmail } from "./emailService.js";
import dotenv from "dotenv";

dotenv.config();

const baseEmailStyles = `
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
`;

export const sendNotificationEmail = async ({ to, name, notification }) => {
  try {
    let emailSubject = notification.title;
    let emailBody = "";

    // Customize email based on notification type
    switch (notification.type) {
      case "new_message":
        emailBody = `
          <div class="container">
            <div class="header">
              <h2>💬 New Message Received</h2>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>${notification.message}</p>
              ${notification.actionUrl ? `<a href="${notification.actionUrl}" class="button">View Message</a>` : ""}
            </div>
            <div class="footer">
              <p>Best regards,<br/>Zayan Team</p>
            </div>
          </div>
        `;
        break;

      case "new_review":
        emailBody = `
          <div class="container">
            <div class="header">
              <h2>⭐ New Review Received</h2>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>${notification.message}</p>
              ${notification.actionUrl ? `<a href="${notification.actionUrl}" class="button">View Review</a>` : ""}
            </div>
            <div class="footer">
              <p>Best regards,<br/>Zayan Team</p>
            </div>
          </div>
        `;
        break;

      case "listing_inquiry":
        emailBody = `
          <div class="container">
            <div class="header">
              <h2>📋 New Listing Inquiry</h2>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>${notification.message}</p>
              ${notification.actionUrl ? `<a href="${notification.actionUrl}" class="button">View Inquiry</a>` : ""}
            </div>
            <div class="footer">
              <p>Best regards,<br/>Zayan Team</p>
            </div>
          </div>
        `;
        break;

      case "order_placed":
        emailBody = `
          <div class="container">
            <div class="header">
              <h2>🛒 New Order Placed</h2>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>${notification.message}</p>
              ${notification.actionUrl ? `<a href="${notification.actionUrl}" class="button">View Order</a>` : ""}
            </div>
            <div class="footer">
              <p>Best regards,<br/>Zayan Team</p>
            </div>
          </div>
        `;
        break;

      case "verification_approved":
        emailBody = `
          <div class="container">
            <div class="header">
              <h2>✅ Verification Approved</h2>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>${notification.message}</p>
              <p>Congratulations! Your account has been verified.</p>
              ${notification.actionUrl ? `<a href="${notification.actionUrl}" class="button">View Profile</a>` : ""}
            </div>
            <div class="footer">
              <p>Best regards,<br/>Zayan Team</p>
            </div>
          </div>
        `;
        break;

      case "verification_rejected":
        emailBody = `
          <div class="container">
            <div class="header">
              <h2>❌ Verification Rejected</h2>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>${notification.message}</p>
              <p>Please review the requirements and resubmit your verification documents.</p>
              ${notification.actionUrl ? `<a href="${notification.actionUrl}" class="button">Resubmit</a>` : ""}
            </div>
            <div class="footer">
              <p>Best regards,<br/>Zayan Team</p>
            </div>
          </div>
        `;
        break;

      default:
        emailBody = `
          <div class="container">
            <div class="header">
              <h2>🔔 New Notification</h2>
            </div>
            <div class="content">
              <p>Hi ${name},</p>
              <p>${notification.message}</p>
              ${notification.actionUrl ? `<a href="${notification.actionUrl}" class="button">View Details</a>` : ""}
            </div>
            <div class="footer">
              <p>Best regards,<br/>Zayan Team</p>
            </div>
          </div>
        `;
    }

    await sendEmail({
      to,
      subject: emailSubject,
      html: baseEmailStyles + emailBody,
    });

    console.log(
      `✅ [sendNotificationEmail] Notification email sent to ${to} via SendGrid`,
    );
    return true;
  } catch (error) {
    console.error(
      "❌ [sendNotificationEmail] Failed to send notification email via SendGrid:",
      error.message,
    );
    return false;
  }
};
