import { summarizeText as chainSummarizeText } from '../chains/summarize.chain';
import { summarizeTitle as chainSummarizeTitle } from '../chains/title.chain';
import { generateWhyItMatters as chainWhyItMatters } from '../chains/why-it-matters.chain';
import { generateQuestions as chainQuestions } from '../chains/questions.chain';
import { detectBias as chainDetectBias } from '../chains/bias.chain';
import { generateELI5 as chainELI5 } from '../chains/eli5.chain';
import { analyzeArticle as chainAnalyze } from '../chains/analyze.chain';
import { generateCatchUpBrief as chainCatchUpBrief } from '../chains/catch-up-brief.chain';

class GroqService {
  async summarizeText(text: string, language = 'english'): Promise<string> {
    return chainSummarizeText(text, language);
  }

  async summarizeTitle(text: string, language = 'english'): Promise<string> {
    return chainSummarizeTitle(text, language);
  }

  async generateWhyItMatters(title: string, content: string): Promise<string> {
    return chainWhyItMatters(title, content);
  }

  async generateQuestions(title: string, content: string): Promise<Array<{ q: string; a: string }>> {
    return chainQuestions(title, content);
  }

  async detectBias(title: string, content: string): Promise<{ label: string; score: number }> {
    return chainDetectBias(title, content);
  }

  async generateELI5(title: string, content: string): Promise<string> {
    return chainELI5(title, content);
  }

  async analyzeArticle(title: string, content: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    entities: Array<{ name: string; type: string }>;
  }> {
    return chainAnalyze(title, content);
  }

  async generateCatchUpBrief(headlines: string[]): Promise<string> {
    return chainCatchUpBrief(headlines);
  }
}

export const groqService = new GroqService();
