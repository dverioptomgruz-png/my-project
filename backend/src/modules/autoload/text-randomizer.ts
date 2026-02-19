/**
 * Text Randomizer (Spintax) Utility for Avito Autoload
 * 
 * Supports:
 * 1. Spintax: {variant1|variant2|variant3} - random pick
 * 2. Nested spintax: {Hello|Hi {World|Earth}} - recursive
 * 3. Macros: [CITY], [PRICE], [SIZE] - variable substitution
 * 4. Photo randomization: shuffle order, pick from pool
 * 5. Batch generation: create N unique variants from one template
 */

// =============================================
// SPINTAX ENGINE
// =============================================

/**
 * Parse and resolve spintax template into a single random variant.
 * Handles nested braces: {a|b {c|d}} -> "a" or "b c" or "b d"
 */
export function spinOne(template: string): string {
  if (!template) return '';

  let result = template;
  // Resolve from innermost braces outward
  const regex = /\{([^{}]+)\}/g;
  let prev = '';
  while (prev !== result) {
    prev = result;
    result = result.replace(regex, (_, group) => {
      const options = group.split('|');
      return options[Math.floor(Math.random() * options.length)].trim();
    });
  }
  return result;
}

/**
 * Generate N unique spintax variants from a template.
 * If allowDuplicates=false, will try to avoid repeats (up to maxAttempts).
 */
export function spinMany(
  template: string,
  count: number,
  allowDuplicates = false,
  maxAttempts = 50000,
): { results: string[]; unique: number; duplicates: number } {
  const results: string[] = [];
  const seen = new Set<string>();
  let attempts = 0;

  while (results.length < count && attempts < maxAttempts) {
    const variant = spinOne(template);
    attempts++;

    if (allowDuplicates) {
      results.push(variant);
      if (!seen.has(variant)) seen.add(variant);
    } else {
      if (!seen.has(variant)) {
        seen.add(variant);
        results.push(variant);
      }
    }
  }

  // If not enough unique, fill with duplicates
  if (!allowDuplicates && results.length < count) {
    const existing = [...results];
    while (results.length < count) {
      results.push(existing[results.length % existing.length]);
    }
  }

  return {
    results,
    unique: seen.size,
    duplicates: results.length - seen.size,
  };
}

/**
 * Count total possible unique combinations in a spintax template.
 */
export function countVariants(template: string): number {
  if (!template) return 0;

  let text = template;
  const regex = /\{([^{}]+)\}/g;
  let prev = '';
  let total = 1;

  while (prev !== text) {
    prev = text;
    text = text.replace(regex, (_, group) => {
      const options = group.split('|');
      total *= options.length;
      return options[0];
    });
  }

  return total;
}

// =============================================
// MACRO REPLACEMENT
// =============================================

export type MacroMap = Record<string, string | string[]>;

/**
 * Replace [MACRO] placeholders with values from a map.
 * If value is an array, picks a random element.
 */
export function replaceMacros(template: string, macros: MacroMap): string {
  if (!template || !macros) return template || '';

  return template.replace(/\[(\w+)\]/g, (match, key) => {
    const val = macros[key];
    if (val === undefined) return match;
    if (Array.isArray(val)) {
      return val[Math.floor(Math.random() * val.length)];
    }
    return String(val);
  });
}

// =============================================
// PHOTO RANDOMIZATION
// =============================================

export interface PhotoPool {
  urls: string[];
  minPhotos?: number;
  maxPhotos?: number;
}

/**
 * Shuffle array using Fisher-Yates algorithm.
 */
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Pick N random photos from a pool, shuffled.
 * If pool has fewer photos than requested, returns all shuffled.
 */
export function randomizePhotos(
  pool: PhotoPool,
  count?: number,
): string[] {
  if (!pool || !pool.urls || pool.urls.length === 0) return [];

  const min = pool.minPhotos || 1;
  const max = pool.maxPhotos || pool.urls.length;
  const n = count || Math.floor(Math.random() * (max - min + 1)) + min;
  const shuffled = shuffle(pool.urls);

  return shuffled.slice(0, Math.min(n, shuffled.length));
}

// =============================================
// TITLE RANDOMIZATION
// =============================================

/**
 * Generate a unique title from spintax + macros.
 * Ensures it stays within Avito title length limit (50 chars by default).
 */
export function randomizeTitle(
  template: string,
  macros?: MacroMap,
  maxLength = 50,
): string {
  let title = template;
  if (macros) title = replaceMacros(title, macros);
  title = spinOne(title);
  return title.length > maxLength ? title.substring(0, maxLength).trim() : title;
}

// =============================================
// MAIN TEXT RANDOMIZER CLASS
// =============================================

export interface RandomizeOptions {
  titleTemplate?: string;
  descriptionTemplate?: string;
  macros?: MacroMap;
  photoPool?: PhotoPool;
  photoCount?: number;
  titleMaxLength?: number;
  count?: number;
  allowDuplicates?: boolean;
}

export interface RandomizedItem {
  title: string;
  description: string;
  photos: string[];
}

/**
 * Main class for generating randomized Avito listings.
 * Combines spintax, macros, photo randomization.
 */
export class TextRandomizer {
  /**
   * Generate a single randomized item (title + description + photos).
   */
  static generateOne(options: RandomizeOptions): RandomizedItem {
    const macros = options.macros || {};

    const title = options.titleTemplate
      ? randomizeTitle(
          options.titleTemplate,
          macros,
          options.titleMaxLength || 50,
        )
      : '';

    let description = options.descriptionTemplate || '';
    if (description) {
      description = replaceMacros(description, macros);
      description = spinOne(description);
    }

    const photos = options.photoPool
      ? randomizePhotos(options.photoPool, options.photoCount)
      : [];

    return { title, description, photos };
  }

  /**
   * Generate N randomized items. Tries to ensure unique descriptions.
   */
  static generateMany(
    options: RandomizeOptions,
    count?: number,
  ): RandomizedItem[] {
    const n = count || options.count || 10;
    const items: RandomizedItem[] = [];
    const seenDescriptions = new Set<string>();
    let attempts = 0;
    const maxAttempts = n * 100;

    while (items.length < n && attempts < maxAttempts) {
      const item = TextRandomizer.generateOne(options);
      attempts++;

      if (options.allowDuplicates || !seenDescriptions.has(item.description)) {
        seenDescriptions.add(item.description);
        items.push(item);
      }
    }

    // Fill remaining if not enough unique
    while (items.length < n && items.length > 0) {
      const base = items[items.length % items.length];
      items.push({ ...base });
    }

    return items;
  }

  /**
   * Preview: generate a few samples without saving.
   * Useful for UI preview before mass generation.
   */
  static preview(
    options: RandomizeOptions,
    sampleCount = 3,
  ): {
    samples: RandomizedItem[];
    totalPossibleVariants: number;
    titleVariants: number;
    descriptionVariants: number;
  } {
    const samples = TextRandomizer.generateMany(options, sampleCount);
    const titleVariants = options.titleTemplate
      ? countVariants(options.titleTemplate)
      : 0;
    const descriptionVariants = options.descriptionTemplate
      ? countVariants(options.descriptionTemplate)
      : 0;

    return {
      samples,
      totalPossibleVariants: Math.max(titleVariants, 1) * Math.max(descriptionVariants, 1),
      titleVariants,
      descriptionVariants,
    };
  }

  /**
   * Validate a spintax template for syntax errors.
   */
  static validate(template: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    if (!template) {
      errors.push('Template is empty');
      return { valid: false, errors };
    }

    // Check balanced braces
    let depth = 0;
    for (let i = 0; i < template.length; i++) {
      if (template[i] === '{') depth++;
      if (template[i] === '}') depth--;
      if (depth < 0) {
        errors.push(`Unexpected closing brace at position ${i}`);
        break;
      }
    }
    if (depth > 0) {
      errors.push(`${depth} unclosed opening brace(s)`);
    }

    // Check for empty options
    const emptyOptions = template.match(/\{\s*\}/g);
    if (emptyOptions) {
      errors.push(`${emptyOptions.length} empty spintax group(s) found`);
    }

    // Check for single-option groups (no pipe)
    const singleOption = template.match(/\{[^{}|]+\}/g);
    if (singleOption) {
      errors.push(`${singleOption.length} group(s) with only one option (no "|" separator)`);
    }

    return { valid: errors.length === 0, errors };
  }
}
