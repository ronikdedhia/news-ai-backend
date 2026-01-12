import Groq from 'groq-sdk';
import { config } from '../config';
import { logger } from '../utils/logger';

class GroqService {
  private client: Groq;

  constructor() {
    this.client = new Groq({
      apiKey: config.groq.apiKey,
    });
  }

  async summarizeText(text: string, language: string = 'english'): Promise<string> {
    try {
      const truncatedText = text.slice(0, 1000);

      const languagePrompts: Record<string, string> = {
        hindi: 'आप एक पेशेवर समाचार सारांशकर्ता हैं। निम्नलिखित समाचार लेख का संक्षिप्त सारांश हिंदी में 100 शब्दों में बनाएं।',
        marathi: 'तुम्ही एक व्यावसायिक बातम्या सारांशकर्ता आहात। खालील बातमी लेखाचा संक्षिप्त सारांश मराठीत 100 शब्दांत तयार करा।',
        gujarati: 'તમે એક વ્યાવસાયિક સમાચાર સારાંશકાર છો। નીચેના સમાચાર લેખનો સંક્ષિપ્ત સારાંશ ગુજરાતીમાં 100 શબ્દોમાં બનાવો।',
        tamil: 'நீங்கள் ஒரு தொழில்முறை செய்தி சுருக்கமாக்குபவர். பின்வரும் செய்தி கட்டுரையின் சுருக்கமான சுருக்கத்தை தமிழில் 100 வார்த்தைகளில் உருவாக்கவும்.',
        spanish: 'Eres un resumidor profesional de noticias. Crea un resumen conciso del siguiente artículo de noticias en español en exactamente 100 palabras.',
        french: 'Vous êtes un résumeur professionnel d\'actualités. Créez un résumé concis de l\'article de presse suivant en français en exactement 100 mots.',
        german: 'Sie sind ein professioneller Nachrichtenzusammenfasser. Erstellen Sie eine prägnante Zusammenfassung des folgenden Nachrichtenartikels auf Deutsch in genau 100 Wörtern.',
        english: 'You are a professional news summarizer. Create a concise, informative summary of the following news article in exactly 100 words.'
      };

      const systemPrompt = languagePrompts[language] || languagePrompts.english;

      const completion = await this.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: truncatedText,
          },
        ],
        model: config.groq.model,
        temperature: 0.3,
        max_tokens: 150,
        top_p: 1,
      });

      return completion.choices[0]?.message?.content?.trim() || '';
    } catch (error: any) {
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  async summarizeBatch(texts: string[], language: string = 'english'): Promise<string[]> {
    const summaries: string[] = [];

    for (const text of texts) {
      try {
        const summary = await this.summarizeText(text, language);
        summaries.push(summary);
        
        // Small delay to avoid rate limiting
        await this.delay(100);
      } catch (error: any) {
        logger.error(`Failed to summarize text: ${error.message}`);
        summaries.push('Summary generation failed');
      }
    }

    return summaries;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const groqService = new GroqService();