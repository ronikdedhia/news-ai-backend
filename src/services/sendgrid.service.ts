import * as sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger';

const apiKey = process.env.SENDGRID_EMAIL_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@newsai.com';
const fromName = process.env.SENDGRID_FROM_NAME || 'NewsAI';

if (!apiKey) {
  logger.error('❌ SENDGRID_EMAIL_API_KEY is not set in environment variables');
}

sgMail.setApiKey(apiKey || '');

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class SendGridService {
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const msg = {
        to: options.to,
        from: {
          email: fromEmail,
          name: fromName,
        },
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
      };

      await sgMail.send(msg);
      logger.info(`✅ Email sent to ${options.to}`);
      return true;
    } catch (error: any) {
      logger.error(`❌ Failed to send email to ${options.to}: ${error.message}`);
      return false;
    }
  }

  async sendBulkEmails(emails: string[], subject: string, html: string): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const email of emails) {
      const success = await this.sendEmail({ to: email, subject, html });
      if (success) {
        sent++;
      } else {
        failed++;
      }
    }

    logger.info(`📧 Bulk email results: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }
}

export const sendGridService = new SendGridService();
