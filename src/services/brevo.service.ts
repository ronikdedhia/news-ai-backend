import { logger } from '../utils/logger';

const apiKey = process.env.BREVO_API_KEY;
const fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@newsai.com';
const fromName = process.env.BREVO_FROM_NAME || 'Daily Bytes';

if (!apiKey) {
  logger.error('❌ BREVO_API_KEY is not set in environment variables');
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class BrevoService {
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.html,
          textContent: options.text || options.html.replace(/<[^>]*>/g, ''),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        logger.error(`❌ Failed to send email to ${options.to}: ${response.status} ${body}`);
        return false;
      }

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

export const brevoService = new BrevoService();
