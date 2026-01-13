const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // App Password
      }
    });
  }

  async sendVerificationEmail(to, token, firstName) {
    const verificationLink = `${process.env.APP_DEEP_LINK_SCHEME}://auth/verify?token=${token}`;
    
    // Fallback if deep link scheme isn't set, though it should be for mobile
    const fallbackLink = `${process.env.API_URL || 'http://localhost:3000'}/api/v1/auth/verify-email-redirect/${token}`;
    
    const mailOptions = {
      from: `"WooCommerce App" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Verify your email address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome, ${firstName}!</h2>
          <p>Please verify your email address to complete your registration.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
          </div>
          <p>Or verify via browser: <a href="${fallbackLink}">${fallbackLink}</a></p>
          <p>This link will expire in 24 hours.</p>
        </div>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`📧 Verification email sent to ${to}: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('❌ Error sending email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(to, token) {
     const resetLink = `${process.env.APP_DEEP_LINK_SCHEME}://auth/reset-password?token=${token}`;
     const mailOptions = {
      from: `"WooCommerce App" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Reset your password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>You requested to reset your password.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #008CBA; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </div>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `
    };
    try {
        await this.transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        logger.error('❌ Error sending reset email:', error);
        throw error;
    }
  }
}

module.exports = new EmailService();
