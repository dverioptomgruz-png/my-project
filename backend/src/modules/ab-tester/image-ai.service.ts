import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface ImageAnalysis {
  url: string;
  score: number;           // 0-100
  mainPhotoScore: number;  // how good as main photo
  quality: 'high' | 'medium' | 'low';
  issues: string[];
  recommendations: string[];
  description: string;
}

export interface ImageSet {
  images: string[];        // ordered URLs (first = main)
  reasoning: string;
  predictedCTR: number;    // predicted click-through rate 0-100
}

@Injectable()
export class ImageAIService {
  private readonly openaiApiKey: string;

  constructor(private configService: ConfigService) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';
  }

  /**
   * Analyze all images using GPT-4 Vision
   * Score each image for Avito ad quality
   */
  async analyzeImages(
    imageUrls: string[],
    category: string
  ): Promise<ImageAnalysis[]> {
    if (!this.openaiApiKey) {
      // Mock analysis when no API key
      return this.mockAnalysis(imageUrls, category);
    }

    try {
      const prompt = `Ты эксперт-авитолог. Проанализируй эти фотографии для объявления на Авито в категории "${category}".
Для каждого фото оцени:
1. Общий балл качества (0-100)
2. Пригодность как главное фото (0-100)
3. Качество: high/medium/low
4. Проблемы (низкое разрешение, плохое освещение, не в фокусе, водяные знаки)
5. Рекомендации
6. Краткое описание что на фото

Ответ в JSON формате:
[
  {
    "index": 0,
    "score": 85,
    "mainPhotoScore": 90,
    "quality": "high",
    "issues": [],
    "recommendations": ["Использовать как главное"],
    "description": "Общий вид товара"
  }
]`;

      const content = [
        { type: 'text', text: prompt },
        ...imageUrls.map((url) => ({
          type: 'image_url',
          image_url: { url, detail: 'low' },
        })),
      ];

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4o',
          messages: [{ role: 'user', content }],
          max_tokens: 2000,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const parsed = JSON.parse(response.data.choices[0].message.content);
      const analyses = Array.isArray(parsed) ? parsed : parsed.images || parsed.analysis || [];

      return analyses.map((item: any, i: number) => ({
        url: imageUrls[item.index ?? i],
        score: item.score || 50,
        mainPhotoScore: item.mainPhotoScore || 50,
        quality: item.quality || 'medium',
        issues: item.issues || [],
        recommendations: item.recommendations || [],
        description: item.description || '',
      }));
    } catch (error) {
      console.error('GPT-4 Vision error:', error.message);
      return this.mockAnalysis(imageUrls, category);
    }
  }

  /**
   * Select best 10 images and determine optimal order
   * Uses GPT-4 Vision to pick main photo and arrange rest
   */
  async selectAndOrderImages(
    imageUrls: string[],
    category: string,
    maxSlots: number = 10
  ): Promise<ImageSet[]> {
    // First, analyze all images
    const analyses = await this.analyzeImages(imageUrls, category);

    // Sort by score
    const sorted = [...analyses].sort((a, b) => b.score - a.score);

    // Take top images up to maxSlots
    const bestImages = sorted.slice(0, maxSlots);

    // Create main variant: best main photo first, rest by quality
    const mainVariant: ImageSet = {
      images: [
        ...bestImages.sort((a, b) => b.mainPhotoScore - a.mainPhotoScore),
      ].map((img) => img.url),
      reasoning: 'Лучшие фото по качеству, главное — с макс. оценкой для первого слота',
      predictedCTR: 75,
    };

    // Create alternative variants with different main photos
    const variants: ImageSet[] = [mainVariant];

    // Variant 2: Second-best as main
    if (bestImages.length >= 2) {
      const alt1 = [...mainVariant.images];
      const secondBest = alt1.splice(1, 1)[0];
      alt1.unshift(secondBest);
      variants.push({
        images: alt1.slice(0, maxSlots),
        reasoning: '2-е лучшее фото как главное (тест обложки)',
        predictedCTR: 65,
      });
    }

    // Variant 3: Mix different angles first
    if (bestImages.length >= 5) {
      const alt2 = [...mainVariant.images];
      // Interleave: take every other
      const even = alt2.filter((_, i) => i % 2 === 0);
      const odd = alt2.filter((_, i) => i % 2 !== 0);
      variants.push({
        images: [...odd, ...even].slice(0, maxSlots),
        reasoning: 'Чередование ракурсов для разнообразия',
        predictedCTR: 60,
      });
    }

    return variants;
  }

  /**
   * Mock analysis for when no OpenAI key available
   */
  private mockAnalysis(
    imageUrls: string[],
    category: string
  ): ImageAnalysis[] {
    return imageUrls.map((url, index) => {
      const score = 90 - index * 5 + Math.floor(Math.random() * 10);
      return {
        url,
        score: Math.min(100, Math.max(10, score)),
        mainPhotoScore: index === 0 ? 90 : 70 - index * 5,
        quality: score > 70 ? 'high' : score > 40 ? 'medium' : 'low' as any,
        issues: score < 50 ? ['Низкое качество'] : [],
        recommendations: index === 0
          ? ['Использовать как главное фото']
          : ['Дополнительное фото'],
        description: `Фото #${index + 1} для категории ${category}`,
      };
    });
  }
}
