import { sendEmail } from "./emailService.js";
import dotenv from "dotenv";
dotenv.config();

export const sendOtpEmail = async ({ to, otp, name }) => {
  console.log(`Sending OTP email to ${to}`);

  const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Hi ${name},</h2>
        <p>Thanks for signing up for Zayan.</p>
        <p>Your one-time verification code is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
        <p>This code will expire in 10 minutes. Please do not share it with anyone.</p>
        <p>If you did not create this account, you can safely ignore this email.</p>
        <p>Best regards,<br/>Zayan Team</p>
      </div>
    `;

  try {
    await sendEmail({
      to,
      subject: "Zayan Email Verification Code",
      html,
    });
    console.log("✅ [sendOtpEmail] OTP email sent successfully via SendGrid");
    return true;
  } catch (error) {
    console.error(
      "❌ [sendOtpEmail] Failed to send email via SendGrid:",
      error.message,
    );
    throw error;
  }
};

export default sendOtpEmail;
