import axios from 'axios';
import https from 'https';
import { logger } from '../utils/logger';
import { config } from '../config';

interface TelegramMessage {
  title: string;
  content: string;
  hashtags: string[];
  url?: string;
  imageUrl?: string | null;
}

class TelegramService {
  private readonly sendMessageUrl = `https://api.telegram.org/bot${config.telegram.accessToken}/sendMessage`;
  private readonly sendPhotoUrl = `https://api.telegram.org/bot${config.telegram.accessToken}/sendPhoto`;
  private readonly chatId = config.telegram.channelId;
  private httpsAgent = new https.Agent({ rejectUnauthorized: false });

  async sendMessage(message: TelegramMessage): Promise<boolean> {
    if (!this.chatId || !config.telegram.accessToken) return false;

    // Try photo first, fall back to text if CDN blocks Telegram's crawler
    if (message.imageUrl) {
      const sent = await this.sendPhotoMessage(message);
      if (sent) return true;
      logger.warn('⚠️ Photo send failed, falling back to text message');
    }

    return this.sendTextMessage(message);
  }

  private async sendTextMessage(message: TelegramMessage): Promise<boolean> {
    try {
      const response = await axios.post(
        this.sendMessageUrl,
        {
          chat_id: this.chatId,
          text: this.formatMessage(message),
          parse_mode: 'HTML',
        },
        { headers: { 'Content-Type': 'application/json' }, httpsAgent: this.httpsAgent }
      );

      if (response.data.ok) {
        logger.info('✅ Message sent to Telegram');
        return true;
      }
      logger.warn(`⚠️ Telegram text error: ${response.data.description}`);
      return false;
    } catch (error: any) {
      logger.warn(`⚠️ Telegram text failed (${error.response?.status ?? error.message}): ${error.response?.data?.description ?? ''}`);
      return false;
    }
  }

  private async sendPhotoMessage(message: TelegramMessage): Promise<boolean> {
    try {
      const response = await axios.post(
        this.sendPhotoUrl,
        {
          chat_id: this.chatId,
          photo: message.imageUrl,
          caption: this.formatMessage(message),
          parse_mode: 'HTML',
        },
        { headers: { 'Content-Type': 'application/json' }, httpsAgent: this.httpsAgent }
      );

      if (response.data.ok) {
        logger.info('✅ Photo message sent to Telegram');
        return true;
      }
      logger.warn(`⚠️ Telegram photo error: ${response.data.description}`);
      return false;
    } catch (error: any) {
      logger.warn(`⚠️ Telegram photo failed (${error.response?.status ?? error.message}): ${error.response?.data?.description ?? ''}`);
      return false;
    }
  }

  async sendMessages(messages: TelegramMessage[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;
    for (const message of messages) {
      const success = await this.sendMessage(message);
      success ? sent++ : failed++;
      await this.delay(500);
    }
    return { sent, failed };
  }

  private formatMessage(message: TelegramMessage): string {
    const title = `<b>${this.escapeHtml(message.title)}</b>`;
    const content = `<i>${this.escapeHtml(message.content)}</i>`;
    const url = message.url ? `\n\n<a href="${message.url}">Read Full Article</a>` : '';
    const hashtags = message.hashtags.length > 0 ? `\n\n${message.hashtags.join(' ')}` : '';
    return `${title}\n\n${content}${url}${hashtags}`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const telegramService = new TelegramService();
