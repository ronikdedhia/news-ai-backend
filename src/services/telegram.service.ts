import axios from 'axios';
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

  /**
   * Send message to Telegram channel
   */
  async sendMessage(message: TelegramMessage): Promise<boolean> {
    try {
      if (!this.chatId || !config.telegram.accessToken) {
        logger.warn('⚠️ Telegram credentials not configured, skipping message');
        return false;
      }

      // If image URL is available, send as photo with caption
      if (message.imageUrl) {
        return this.sendPhotoMessage(message);
      }

      // Otherwise send as text message
      const formattedMessage = this.formatMessage(message);

      logger.info(`📤 Sending text message to Telegram channel...`);

      const response = await axios.post(
        this.sendMessageUrl,
        {
          chat_id: this.chatId,
          text: formattedMessage,
          parse_mode: 'HTML',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.ok) {
        logger.info(`✅ Message sent to Telegram successfully`);
        return true;
      } else {
        logger.error(`❌ Telegram API error: ${response.data.description}`);
        return false;
      }
    } catch (error: any) {
      logger.error(`❌ Failed to send Telegram message: ${error.message}`);
      return false;
    }
  }

  /**
   * Send photo message with caption to Telegram channel
   */
  private async sendPhotoMessage(message: TelegramMessage): Promise<boolean> {
    try {
      const caption = this.formatMessage(message);

      logger.info(`📤 Sending photo message to Telegram channel...`);

      const response = await axios.post(
        this.sendPhotoUrl,
        {
          chat_id: this.chatId,
          photo: message.imageUrl,
          caption: caption,
          parse_mode: 'HTML',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.ok) {
        logger.info(`✅ Photo message sent to Telegram successfully`);
        return true;
      } else {
        logger.error(`❌ Telegram API error: ${response.data.description}`);
        return false;
      }
    } catch (error: any) {
      logger.error(`❌ Failed to send Telegram photo: ${error.message}`);
      return false;
    }
  }

  /**
   * Send multiple messages (one per article)
   */
  async sendMessages(messages: TelegramMessage[]): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const message of messages) {
      const success = await this.sendMessage(message);
      if (success) {
        sent++;
      } else {
        failed++;
      }
      // Add delay between messages to avoid rate limiting
      await this.delay(500);
    }

    return { sent, failed };
  }

  /**
   * Format message with title, content, hashtags, url, and imageUrl
   */
  private formatMessage(message: TelegramMessage): string {
    const title = `<b>${this.escapeHtml(message.title)}</b>`;
    const content = `<i>${this.escapeHtml(message.content)}</i>`;
    const url = message.url ? `\n\n<a href="${message.url}">Read Full Article</a>` : '';
    const hashtags = message.hashtags.length > 0 ? `\n\n${message.hashtags.join(' ')}` : '';

    return `${title}\n\n${content}${url}${hashtags}`;
  }

  /**
   * Escape HTML special characters for Telegram
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const telegramService = new TelegramService();
