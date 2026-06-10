import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createLLM, RETRY_CONFIG } from '../config/llm.config';

const LANGUAGE_PROMPTS: Record<string, string> = {
  hindi: 'आप एक पेशेवर समाचार सारांशकर्ता हैं। निम्नलिखित समाचार लेख का संक्षिप्त सारांश हिंदी में 50-70 शब्दों में बनाएं। केवल मुख्य तथ्य शामिल करें, कोई अनुमान नहीं।',
  marathi: 'तुम्ही एक व्यावसायिक बातम्या सारांशकर्ता आहात। खालील बातमी लेखाचा संक्षिप्त सारांश मराठीत 50-70 शब्दांत तयार करा। केवळ मुख्य तथ्य समाविष्ट करा।',
  gujarati: 'તમે એક વ્યાવસાયિક સમાચાર સારાંશકાર છો। નીચેના સમાચાર લેખનો સંક્ષિપ્ત સારાંશ ગુજરાતીમાં 50-70 શબ્દોમાં બનાવો। માત્ર મુખ્ય તથ્યો શામેલ કરો।',
  tamil: 'நீங்கள் ஒரு தொழில்முறை செய்தி சுருக்கமாக்குபவர். பின்வரும் செய்தி கட்டுரையின் சுருக்கமான சுருக்கத்தை தமிழில் 50-70 வார்த்தைகளில் உருவாக்கவும். முக்கிய உண்மைகளை மட்டும் சேர்க்கவும்.',
  spanish: 'Eres un resumidor profesional de noticias. Crea un resumen conciso del siguiente artículo en español en 50-70 palabras. Solo incluye hechos principales, sin inferencias.',
  french: "Vous êtes un résumeur professionnel d'actualités. Créez un résumé concis de l'article suivant en français en 50-70 mots. Incluez uniquement les faits principaux.",
  german: 'Sie sind ein professioneller Nachrichtenzusammenfasser. Erstellen Sie eine prägnante Zusammenfassung des folgenden Artikels auf Deutsch in 50-70 Wörtern. Nur Hauptfakten, keine Schlussfolgerungen.',
  english: 'You are a professional news summarizer. Create a concise summary of the following news article in 50-70 words. Include only main facts, no inferences or elaborations. IMPORTANT: Your response must be between 50-70 words exactly. Do not exceed 100 words under any circumstances.',
};

const summarizeChain = ChatPromptTemplate.fromMessages([
  ['system', '{systemPrompt}'],
  ['human', '{text}'],
])
  .pipe(createLLM('summarize'))
  .pipe(new StringOutputParser())
  .withRetry(RETRY_CONFIG);

export async function summarizeText(text: string, language = 'english'): Promise<string> {
  return summarizeChain.invoke({
    systemPrompt: LANGUAGE_PROMPTS[language] ?? LANGUAGE_PROMPTS.english,
    text: text.slice(0, 1000),
  });
}
