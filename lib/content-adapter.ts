/**
 * Content Adapter Module
 * Converts Facebook post captions to Pinterest pin titles and descriptions
 * Phase 3: Deterministic templates (no LLM)
 * Phase 4+: Can be extended with AI models
 */

export interface ContentAdapterInput {
  facebookCaption?: string;
  propertyName?: string;
  propertyType?: string;
  location?: string;
  destinationUrl?: string;
}

export interface PinterestContent {
  title: string;
  description?: string;
  link?: string;
}

/**
 * Base content adapter interface for future extensibility
 */
export interface ContentAdapter {
  adapt(input: ContentAdapterInput): PinterestContent;
}

/**
 * Deterministic content adapter (Phase 3)
 * Uses property-aware templates and sanitization
 * No external API calls
 */
export class DeterministicContentAdapter implements ContentAdapter {
  /**
   * PHASE 3 PART 1: Property-specific templates
   *
   * CONFIRMED PROPERTIES (use only):
   * - The Beach Home: Owner-verified, use exact template
   *
   * INVENTED PROPERTIES (removed):
   * - Colombo Heritage, Gampaha Villa: Unconfirmed, removed
   *
   * TEMPLATE HIERARCHY:
   * 1. Exact property name match → use template
   * 2. Generic fallback → build from property name + location
   * 3. Ultimate fallback → generic title + caption
   */
  private propertyTemplates: Record<string, { title: string; description: string }> = {
    'The Beach Home': {
      title: 'Beachfront Villa in Galle, Sri Lanka',
      description:
        'Wake up beside the Indian Ocean at this private beachfront villa near Galle, Sri Lanka. ' +
        'Discover The Beach Home by Ceylon Haven — ideal for families and groups looking for a relaxed south-coast escape.',
    },
  };

  /**
   * Adapt Facebook post to Pinterest pin content
   */
  adapt(input: ContentAdapterInput): PinterestContent {
    const title = this.generateTitle(input);
    const description = this.generateDescription(input, title);

    return {
      title,
      description,
      link: input.destinationUrl,
    };
  }

  /**
   * Generate Pinterest title
   * Hierarchy (no arbitrary caption truncation):
   * 1. Use property-specific template if available
   * 2. Build from property name + location/type combination
   * 3. Use category fallback
   * 4. Ultimate fallback: generic title
   */
  private generateTitle(input: ContentAdapterInput): string {
    // 1. Check for property-specific template
    if (input.propertyName && input.propertyName in this.propertyTemplates) {
      return this.propertyTemplates[input.propertyName]?.title || '';
    }

    // 2. Build title from property identification
    let title = '';

    if (input.propertyName) {
      title += input.propertyName;
    }

    if (input.location) {
      if (title) title += ' in ';
      title += input.location;
    } else if (input.propertyType) {
      if (title) title += ' ';
      title += input.propertyType;
    }

    if (title) {
      return this.truncateText(title, 100);
    }

    // 3. Category fallback: use property type if known
    if (input.propertyType) {
      return `${input.propertyType} Stays in Sri Lanka`;
    }

    // 4. Ultimate fallback: generic title
    return 'Ceylon Haven | Stays in Sri Lanka';
  }

  /**
   * Generate Pinterest description (max 500 characters)
   * Uses property-specific template if available
   * Includes call-to-action
   */
  private generateDescription(input: ContentAdapterInput, title: string): string {
    // Check for property-specific template
    if (input.propertyName && input.propertyName in this.propertyTemplates) {
      let desc = this.propertyTemplates[input.propertyName]?.description || '';

      if (input.destinationUrl) {
        desc += `\n\n${input.destinationUrl}`;
      }

      return this.truncateText(desc, 500);
    }

    // Build generic description from Facebook caption
    if (input.facebookCaption) {
      let desc = this.sanitizeCaption(input.facebookCaption);

      if (input.destinationUrl) {
        desc += `\n\n${input.destinationUrl}`;
      }

      return this.truncateText(desc, 500);
    }

    // Fallback description
    let desc = `Discover our beautiful property in Sri Lanka. ${title}.`;

    if (input.destinationUrl) {
      desc += `\n\n${input.destinationUrl}`;
    }

    return this.truncateText(desc, 500);
  }

  /**
   * Sanitize Facebook caption for Pinterest
   * Remove @mentions, URLs, HTML entities
   */
  private sanitizeCaption(caption: string): string {
    return caption
      .replace(/@\w+/g, '') // Remove @mentions
      .replace(/https?:\/\/\S+/g, '') // Remove URLs
      .replace(/&lt;/g, '<') // Decode HTML entities
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .trim();
  }

  /**
   * Truncate text to maximum length, adding ellipsis if needed
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }

    // Truncate at word boundary if possible
    const truncated = text.substring(0, maxLength - 3);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      // Only truncate at word if we're not cutting too early
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }
}

/**
 * Factory function to create content adapter
 * In Phase 4+, can be extended to support multiple adapter types
 */
export function createContentAdapter(): ContentAdapter {
  return new DeterministicContentAdapter();
}
