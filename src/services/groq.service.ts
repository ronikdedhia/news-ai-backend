import Groq from 'groq-sdk';
import { config } from '../config';
import { logger } from '../utils/logger';
import { SummarizedTitleSchema, SummarizedContentSchema } from '../types';

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
        hindi: 'आप एक पेशेवर समाचार सारांशकर्ता हैं। निम्नलिखित समाचार लेख का संक्षिप्त सारांश हिंदी में 50-70 शब्दों में बनाएं। केवल मुख्य तथ्य शामिल करें, कोई अनुमान नहीं।',
        marathi: 'तुम्ही एक व्यावसायिक बातम्या सारांशकर्ता आहात। खालील बातमी लेखाचा संक्षिप्त सारांश मराठीत 50-70 शब्दांत तयार करा। केवळ मुख्य तथ्य समाविष्ट करा।',
        gujarati: 'તમે એક વ્યાવસાયિક સમાચાર સારાંશકાર છો। નીચેના સમાચાર લેખનો સંક્ષિપ્ત સારાંશ ગુજરાતીમાં 50-70 શબ્દોમાં બનાવો। માત્ર મુખ્ય તથ્યો શામેલ કરો।',
        tamil: 'நீங்கள் ஒரு தொழில்முறை செய்தி சுருக்கமாக்குபவர். பின்வரும் செய்தி கட்டுரையின் சுருக்கமான சுருக்கத்தை தமிழில் 50-70 வார்த்தைகளில் உருவாக்கவும். முக்கிய உண்மைகளை மட்டும் சேர்க்கவும்।',
        spanish: 'Eres un resumidor profesional de noticias. Crea un resumen conciso del siguiente artículo en español en 50-70 palabras. Solo incluye hechos principales, sin inferencias.',
        french: 'Vous êtes un résumeur professionnel d\'actualités. Créez un résumé concis de l\'article suivant en français en 50-70 mots. Incluez uniquement les faits principaux.',
        german: 'Sie sind ein professioneller Nachrichtenzusammenfasser. Erstellen Sie eine prägnante Zusammenfassung des folgenden Artikels auf Deutsch in 50-70 Wörtern. Nur Hauptfakten, keine Schlussfolgerungen.',
        english: 'You are a professional news summarizer. Create a concise summary of the following news article in 50-70 words. Include only main facts, no inferences or elaborations. IMPORTANT: Your response must be between 50-70 words exactly. Do not exceed 100 words under any circumstances.'
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
        temperature: 0.1,
        max_tokens: 100,
        top_p: 1,
      });

      const summary = completion.choices[0]?.message?.content?.trim() || '';
      
      // Validate against schema
      const validated = SummarizedContentSchema.parse(summary);
      return validated;
    } catch (error: any) {
      if (error.name === 'ZodError') {
        logger.error(`❌ Summary validation failed: ${error.message}`);
        throw new Error(`Summary does not meet constraints: ${error.errors[0]?.message}`);
      }
      throw new Error(`Failed to generate summary: ${error.message}`);
    }
  }

  async summarizeTitle(text: string, language: string = 'english'): Promise<string> {
    try {
      const truncatedText = text.slice(0, 200);

      const languagePrompts: Record<string, string> = {
        hindi: 'कार्य: इनपुट शीर्षक को एक संक्षिप्त विषय लेबल में फिर से लिखें। नियम: - आउटपुट में केवल 3 या 4 शब्द होने चाहिए। - केवल शीर्षक में स्पष्ट रूप से मौजूद शब्दों का उपयोग करें। - जोड़ें, अनुमान लगाएं या पुनर्निर्माण न करें। - विराम चिह्न, व्याख्या या स्वरूपण न जोड़ें। केवल विषय लेबल आउटपुट करें।',
        marathi: 'कार्य: इनपुट शीर्षक को एक संक्षिप्त विषय लेबल में पुन: लिखा करा। नियम: - आउटपुट मध्ये फक्त 3 किंवा 4 शब्द असावेत। - शीर्षकात स्पष्टपणे उपस्थित असलेले शब्द वापरा। - जोडू नका, अनुमान लगवू नका किंवा पुन: तयार करू नका। - विराम चिह्न, व्याख्या किंवा स्वरूपण जोडू नका। केवळ विषय लेबल आउटपुट करा।',
        gujarati: 'કાર્ય: ઇનપુટ શીર્ષકને સંક્ષિપ્ત વિષય લેબલમાં ફરીથી લખો। નિયમો: - આઉટપુટમાં માત્ર 3 અથવા 4 શબ્દો હોવા જોઈએ। - શીર્ષકમાં સ્પષ્ટપણે હાજર શબ્દો જ વાપરો। - ઉમેરશો નહીં, અનુમાન કરશો નહીં અથવા પુનર્નિર્માણ કરશો નહીં। - વિરામચિહ્ન, સમજૂતી અથવા ફોર્મેટિંગ ઉમેરશો નહીં। માત્ર વિષય લેબલ આઉટપુટ કરો।',
        tamil: 'பணி: உள்ளீட்டு தலைப்பை ஒரு சுருக்கமான தலைப்பு லேபிளாக மீண்டும் எழுதவும். விதிகள்: - வெளியீடு 3 அல்லது 4 சொற்களை மட்டுமே கொண்டிருக்க வேண்டும். - தலைப்பில் வெளிப்படையாக உள்ள சொற்களை மட்டுமே பயன்படுத்தவும். - சேர்க்க வேண்டாம், அனுமானம் செய்ய வேண்டாம் அல்லது மீண்டும் உருவாக்க வேண்டாம். - நிறுத்தற்குறி, விளக்கம் அல்லது வடிவமைப்பு சேர்க்க வேண்டாம். தலைப்பு லேபிளை மட்டுமே வெளியீடு செய்யவும்.',
        spanish: 'Tarea: Reescribir el título de entrada en una etiqueta de tema concisa. Reglas: - La salida debe contener SOLO 3 o 4 palabras. - Utilice solo palabras explícitamente presentes en el título. - NO agregue, infiera ni reformule. - NO agregue puntuación, explicación ni formato. Genere solo la etiqueta de tema.',
        french: 'Tâche: Réécrire le titre d\'entrée en une étiquette de sujet concise. Règles: - La sortie ne doit contenir QUE 3 ou 4 mots. - Utilisez uniquement les mots explicitement présents dans le titre. - N\'ajoutez pas, n\'inférez pas et ne reformulez pas. - N\'ajoutez pas de ponctuation, d\'explication ou de formatage. Générez uniquement l\'étiquette de sujet.',
        german: 'Aufgabe: Schreiben Sie den Eingabetitel in ein prägnantes Thema-Label um. Regeln: - Die Ausgabe darf NUR 3 oder 4 Wörter enthalten. - Verwenden Sie nur Wörter, die explizit im Titel vorhanden sind. - Fügen Sie NICHT hinzu, schließen Sie NICHT und formulieren Sie NICHT um. - Fügen Sie KEINE Satzzeichen, Erklärung oder Formatierung hinzu. Geben Sie nur das Thema-Label aus.',
        english: 'Task: Rewrite the input title into a concise topic label. Rules: - Output must contain ONLY 3 to 5 words maximum. - Use only words explicitly present in the title. - Do NOT add, infer, or rephrase. - Do NOT add punctuation, explanation, or formatting. Output only the topic label, nothing else.'
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
        temperature: 0,
        max_tokens: 15,
        top_p: 1,
      });

      const title = completion.choices[0]?.message?.content?.trim() || '';
      
      // Validate against schema
      const validated = SummarizedTitleSchema.parse(title);
      return validated;
    } catch (error: any) {
      if (error.name === 'ZodError') {
        logger.error(`❌ Title validation failed: ${error.message}`);
        throw new Error(`Title does not meet constraints: ${error.errors[0]?.message}`);
      }
      throw new Error(`Failed to generate title: ${error.message}`);
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
