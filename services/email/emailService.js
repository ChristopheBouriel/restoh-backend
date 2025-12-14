const { getBrevoClient } = require('./brevoConfig');
const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

/**
 * Email Service - Centralized email sending with Brevo
 */
class EmailService {
  constructor() {
    this.from = {
      email: process.env.EMAIL_FROM || 'noreply@restoh.com',
      name: process.env.EMAIL_FROM_NAME || 'RestOh Restaurant',
    };
  }

  /**
   * Load email template from file
   * @param {string} templateName - Template file name without extension
   * @param {object} variables - Variables to replace in template
   */
  loadTemplate(templateName, variables = {}) {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Email template not found: ${templateName}`);
    }

    let template = fs.readFileSync(templatePath, 'utf8');

    // Replace variables in template
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, variables[key]);
    });

    return template;
  }

  /**
   * Send email using Brevo
   * @param {object} options - Email options
   */
  async sendEmail({ to, subject, htmlContent, textContent }) {
    try {
      const apiInstance = getBrevoClient();

      const sendSmtpEmail = new (require('@getbrevo/brevo').SendSmtpEmail)();

      sendSmtpEmail.sender = this.from;
      sendSmtpEmail.to = [{ email: to }];
      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = htmlContent;

      if (textContent) {
        sendSmtpEmail.textContent = textContent;
      }

      const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

      logger.success('Email sent', { subject });
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Email sending failed', { subject, error: error.message });
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email, name, verificationUrl) {
    const htmlContent = this.loadTemplate('verification', {
      name,
      verificationUrl,
      year: new Date().getFullYear(),
    });

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - RestOh Restaurant',
      htmlContent,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, name, resetUrl) {
    const htmlContent = this.loadTemplate('passwordReset', {
      name,
      resetUrl,
      year: new Date().getFullYear(),
    });

    return this.sendEmail({
      to: email,
      subject: 'Reset Your Password - RestOh Restaurant',
      htmlContent,
    });
  }

  /**
   * Send newsletter email
   */
  async sendNewsletterEmail(email, name, content, unsubscribeUrl) {
    const htmlContent = this.loadTemplate('newsletter', {
      name,
      content,
      unsubscribeUrl,
      year: new Date().getFullYear(),
    });

    return this.sendEmail({
      to: email,
      subject: 'RestOh Newsletter - Latest Updates',
      htmlContent,
    });
  }

  /**
   * Send promotion email
   */
  async sendPromotionEmail(email, name, promotionContent, unsubscribeUrl) {
    const htmlContent = this.loadTemplate('promotion', {
      name,
      promotionContent,
      unsubscribeUrl,
      year: new Date().getFullYear(),
    });

    return this.sendEmail({
      to: email,
      subject: 'Special Offer from RestOh!',
      htmlContent,
    });
  }

  /**
   * Send bulk emails (for newsletter/promotions)
   * @param {Array} recipients - Array of {email, name, variables}
   * @param {string} subject - Email subject
   * @param {string} templateName - Template to use
   */
  async sendBulkEmails(recipients, subject, templateName) {
    const results = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (const recipient of recipients) {
      try {
        const htmlContent = this.loadTemplate(templateName, {
          ...recipient.variables,
          name: recipient.name,
          year: new Date().getFullYear(),
        });

        await this.sendEmail({
          to: recipient.email,
          subject,
          htmlContent,
        });

        results.success++;

        // Rate limiting: wait 100ms between emails to avoid hitting limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: recipient.email,
          error: error.message,
        });
      }
    }

    return results;
  }
}

// Export singleton instance
module.exports = new EmailService();
