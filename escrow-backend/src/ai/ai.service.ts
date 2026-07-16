import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * Thin wrapper around whichever AI provider is active (NVIDIA NIM by
 * default, OpenRouter as fallback — both are OpenAI-SDK compatible, so
 * switching is just swapping base URL / key / model from env).
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: OpenAI;
  private model: string;

  constructor(private readonly config: ConfigService) {
    const provider = this.config.get<string>('AI_PROVIDER', 'nvidia');

    if (provider === 'openrouter') {
      this.client = new OpenAI({
        apiKey: this.config.get<string>('OPENROUTER_API_KEY', ''),
        baseURL: this.config.get<string>('OPENROUTER_BASE_URL', ''),
        timeout: 10_000,
      });
      this.model = this.config.get<string>('OPENROUTER_MODEL', '');
    } else {
      this.client = new OpenAI({
        apiKey: this.config.get<string>('NVIDIA_API_KEY', ''),
        baseURL: this.config.get<string>('NVIDIA_BASE_URL', ''),
        timeout: 10_000,
      });
      this.model = this.config.get<string>('NVIDIA_MODEL', '');
    }
  }

  /**
   * Parses a seller's free-text deal description into structured fields.
   * e.g. "sold 2 phone cases to Musa for 3000 each and a charger for 2000"
   */
  async extractDealFromText(text: string): Promise<{
    buyerName?: string;
    items: { name: string; unitPrice: number; quantity: number }[];
  }> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'Extract structured deal info from Nigerian seller messages. ' +
              'Respond ONLY with JSON, no preamble, no markdown fences. ' +
              'Shape: {"buyerName": string|null, "items": [{"name": string, "unitPrice": number, "quantity": number}]}. ' +
              'Prices are in Naira. If quantity is not stated, default to 1.',
          },
          { role: 'user', content: text },
        ],
        temperature: 0,
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      this.logger.debug(`Raw AI response for extractDealFromText: ${raw}`);

      try {
        return JSON.parse(this.stripFences(raw));
      } catch (err) {
        this.logger.error(`Failed to parse AI response as JSON: ${raw}`, err instanceof Error ? err.stack : err);
        return { items: [] };
      }
    } catch (err) {
      this.logger.error(`AI request failed in extractDealFromText: ${err instanceof Error ? err.message : err}`);
      return { items: [] };
    }
  }

  /** Turns raw escrow stats into the 7am digest sentence. */
  async draftDigest(stats: {
    totalInEscrow: number;
    counts: Record<string, number>;
    nearDeadline: number;
  }): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'Write a short, warm, one-paragraph morning digest for a Nigerian small ' +
            'business owner about their escrow deals. Use Naira (₦). Keep it under 40 words.',
        },
        { role: 'user', content: JSON.stringify(stats) },
      ],
      temperature: 0.5,
    });

    return completion.choices[0]?.message?.content ?? '';
  }

  /** Drafts a neutral side-by-side summary for the admin dispute queue. */
  async summarizeDispute(buyerReason: string, sellerResponse?: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'Summarize this buyer/seller dispute neutrally in 2-3 sentences for an ' +
            'admin reviewer. Do not take a side.',
        },
        {
          role: 'user',
          content: `Buyer says: ${buyerReason}\nSeller says: ${sellerResponse ?? '(no response yet)'}`,
        },
      ],
      temperature: 0.2,
    });

    return completion.choices[0]?.message?.content ?? '';
  }

  private stripFences(text: string): string {
    return text.replace(/```json|```/g, '').trim();
  }
}
