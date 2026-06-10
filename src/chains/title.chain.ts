import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { createLLM, RETRY_CONFIG } from '../config/llm.config';

const LANGUAGE_PROMPTS: Record<string, string> = {
  hindi: 'कार्य: इनपुट शीर्षक को एक संक्षिप्त विषय लेबल में फिर से लिखें। नियम: - आउटपुट में केवल 3 या 4 शब्द होने चाहिए। - केवल शीर्षक में स्पष्ट रूप से मौजूद शब्दों का उपयोग करें। - जोड़ें, अनुमान लगाएं या पुनर्निर्माण न करें। - विराम चिह्न, व्याख्या या स्वरूपण न जोड़ें। केवल विषय लेबल आउटपुट करें।',
  marathi: 'कार्य: इनपुट शीर्षक को एक संक्षिप्त विषय लेबल में पुन: लिखा करा। नियम: - आउटपुट मध्ये फक्त 3 किंवा 4 शब्द असावेत। - शीर्षकात स्पष्टपणे उपस्थित असलेले शब्द वापरा। - जोडू नका, अनुमान लगवू नका किंवा पुन: तयार करू नका। - विराम चिह्न, व्याख्या किंवा स्वरूपण जोडू नका। केवळ विषय लेबल आउटपुट करा।',
  gujarati: 'કાર્ય: ઇનપુટ શીર્ષકને સંક્ષિપ્ત વિષય લેબલમાં ફરીથી લખો। નિયમો: - આઉટપુટમાં માત્ર 3 અથવા 4 શબ્દો હોવા જોઈએ। - શીર્ષકમાં સ્પષ્ટપણે હાજર શબ્દો જ વાપરો। - ઉમેરશો નહીં, અનુમાન કરશો નહીં અથવા પુનર્નિર્માણ કરશો નહીં। - વિરામચિહ્ન, સમજૂતી અથવા ફોર્મેટિંગ ઉમેરશો નહીં। માત્ર વિષય લેબલ આઉટપુટ કરો।',
  tamil: 'பணி: உள்ளீட்டு தலைப்பை ஒரு சுருக்கமான தலைப்பு லேபிளாக மீண்டும் எழுதவும். விதிகள்: - வெளியீடு 3 அல்லது 4 சொற்களை மட்டுமே கொண்டிருக்க வேண்டும். - தலைப்பில் வெளிப்படையாக உள்ள சொற்களை மட்டுமே பயன்படுத்தவும். - சேர்க்க வேண்டாம், அனுமானம் செய்ய வேண்டாம் அல்லது மீண்டும் உருவாக்க வேண்டாம். - நிறுத்தற்குறி, விளக்கம் அல்லது வடிவமைப்பு சேர்க்க வேண்டாம். தலைப்பு லேபிளை மட்டுமே வெளியீடு செய்யவும்.',
  spanish: 'Tarea: Reescribir el título de entrada en una etiqueta de tema concisa. Reglas: - La salida debe contener SOLO 3 o 4 palabras. - Utilice solo palabras explícitamente presentes en el título. - NO agregue, infiera ni reformule. - NO agregue puntuación, explicación ni formato. Genere solo la etiqueta de tema.',
  french: "Tâche: Réécrire le titre d'entrée en une étiquette de sujet concise. Règles: - La sortie ne doit contenir QUE 3 ou 4 mots. - Utilisez uniquement les mots explicitement présents dans le titre. - N'ajoutez pas, n'inférez pas et ne reformulez pas. - N'ajoutez pas de ponctuation, d'explication ou de formatage. Générez uniquement l'étiquette de sujet.",
  german: 'Aufgabe: Schreiben Sie den Eingabetitel in ein prägnantes Thema-Label um. Regeln: - Die Ausgabe darf NUR 3 oder 4 Wörter enthalten. - Verwenden Sie nur Wörter, die explizit im Titel vorhanden sind. - Fügen Sie NICHT hinzu, schließen Sie NICHT und formulieren Sie NICHT um. - Fügen Sie KEINE Satzzeichen, Erklärung oder Formatierung hinzu. Geben Sie nur das Thema-Label aus.',
  english: 'Task: Rewrite the input title into a concise topic label. Rules: - Output must contain ONLY 3 to 5 words maximum. - Use only words explicitly present in the title. - Do NOT add, infer, or rephrase. - Do NOT add punctuation, explanation, or formatting. Output only the topic label, nothing else.',
};

const titleChain = ChatPromptTemplate.fromMessages([
  ['system', '{systemPrompt}'],
  ['human', '{text}'],
])
  .pipe(createLLM('title'))
  .pipe(new StringOutputParser())
  .withRetry(RETRY_CONFIG);

export async function summarizeTitle(text: string, language = 'english'): Promise<string> {
  return titleChain.invoke({
    systemPrompt: LANGUAGE_PROMPTS[language] ?? LANGUAGE_PROMPTS.english,
    text: text.slice(0, 200),
  });
}
