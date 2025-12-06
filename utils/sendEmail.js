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
console.log("email credentials",process.env.MAIL_USER, process.env.MAIL_PASS);
export const sendOtpEmail = async ({ to, otp, name }) => {
    
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    throw new Error("Email credentials are not configured");
  }

  const mailOptions = {
    from: `"zayan" <${process.env.MAIL_USER}>`,
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

  await transporter.sendMail(mailOptions);
};

export default sendOtpEmail;

