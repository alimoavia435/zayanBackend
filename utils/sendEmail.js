import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.MAIL_USER || "maharalimoavia396@gmail.com",
    pass: process.env.MAIL_PASS || "idku nwib vxcp jwpr",
  },
});
console.log("email credentials", process.env.MAIL_USER, process.env.MAIL_PASS);

// Verify transporter configuration on startup
transporter.verify(function (error, success) {
  if (error) {
    console.error("❌ Email transporter verification failed:", error.message);
  } else {
    console.log("✅ Email server is ready to send messages");
  }
});

export const sendOtpEmail = async ({ to, otp, name }) => {
  console.log("📧 [sendOtpEmail] Starting email send process...");
  console.log("📧 [sendOtpEmail] Recipient:", to);
  console.log("📧 [sendOtpEmail] Name:", name);

  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.error("❌ [sendOtpEmail] Email credentials are not configured!");
    throw new Error("Email credentials are not configured");
  }

  console.log("✅ [sendOtpEmail] Email credentials verified");

  const mailOptions = {
    from: `"Zayan" <${process.env.MAIL_USER}>`,
    to,
    subject: "Zayan Email Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Hi ${name},</h2>
        <p>Thanks for signing up for Zayan.</p>
        <p>Your one-time verification code is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
        <p>This code will expire in 10 minutes. Please do not share it with anyone.</p>
        <p>If you did not create this account, you can safely ignore this email.</p>
        <p>Best regards,<br/>Zayan Team</p>
      </div>
    `,
  };

  console.log("📧 [sendOtpEmail] Mail options prepared, attempting to send...");

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ [sendOtpEmail] Email sent successfully!");
    console.log("📧 [sendOtpEmail] Message ID:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ [sendOtpEmail] Failed to send email:");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    throw error;
  }
};

export default sendOtpEmail;
