/**
 * Content Adapter Unit Tests
 * Tests deterministic template-based content generation
 */

import { describe, it, expect } from 'vitest';
import { DeterministicContentAdapter } from './content-adapter';

describe('DeterministicContentAdapter', () => {
  const adapter = new DeterministicContentAdapter();

  describe('adapt', () => {
    it('should use property-specific template for The Beach Home', () => {
      const input = {
        propertyName: 'The Beach Home',
        facebookCaption: 'Sunset at the beach',
        destinationUrl: 'https://ceylonhaven.com/beach-home',
      };

      const result = adapter.adapt(input);

      expect(result.title).toBe('Beachfront Villa in Galle, Sri Lanka');
      expect(result.description).toContain('Wake up beside the Indian Ocean');
      expect(result.link).toBe('https://ceylonhaven.com/beach-home');
    });

    it('should use generic template for unknown property (fallback)', () => {
      // PHASE 3 PART 1: Removed invented property "Colombo Heritage"
      // Test generic fallback for any unrecognized property name
      const input = {
        propertyName: 'Property A',
        propertyType: 'Boutique Hotel',
        location: 'Colombo',
        facebookCaption: 'Exploring the city',
      };

      const result = adapter.adapt(input);

      // Should use generic title builder, not template
      expect(result.title).toContain('Property A');
      expect(result.title).toContain('Colombo');
    });

    it('should build generic title from property name and location', () => {
      const input = {
        propertyName: 'New Villa',
        location: 'Sri Lanka',
        facebookCaption: 'Check out our new place',
      };

      const result = adapter.adapt(input);

      expect(result.title).toContain('New Villa');
      expect(result.title).toContain('Sri Lanka');
    });

    it('should use generic fallback when no property data available', () => {
      // PHASE 3 PART 1: Removed arbitrary caption truncation
      // Falls back to generic title instead of truncating caption
      const input = {
        facebookCaption: 'Beautiful morning at the property',
      };

      const result = adapter.adapt(input);

      // Should use generic fallback, not caption truncation
      expect(result.title).toBe('Ceylon Haven | Stays in Sri Lanka');
    });

    it('should sanitize caption by removing mentions', () => {
      const input = {
        propertyName: 'Test Property',
        facebookCaption: 'Amazing place! @ceylonhaven @friends check this out',
      };

      const result = adapter.adapt(input);

      expect(result.description).not.toContain('@');
    });

    it('should sanitize caption by removing URLs', () => {
      const input = {
        propertyName: 'Test Property',
        facebookCaption: 'Visit https://example.com for more info about our place',
      };

      const result = adapter.adapt(input);

      expect(result.description).not.toContain('https://');
    });

    it('should truncate long property names/locations to 100 characters', () => {
      const longPropertyName = 'a'.repeat(150);
      const input = {
        propertyName: longPropertyName,
        location: 'Sri Lanka',
      };

      const result = adapter.adapt(input);

      expect(result.title.length).toBeLessThanOrEqual(100);
    });

    it('should truncate long descriptions to 500 characters', () => {
      const longCaption = 'a'.repeat(600);
      const input = {
        propertyName: 'Test Property',
        facebookCaption: longCaption,
      };

      const result = adapter.adapt(input);

      expect(result.description!.length).toBeLessThanOrEqual(500);
    });

    it('should include destination URL in description', () => {
      const input = {
        propertyName: 'Test Property',
        destinationUrl: 'https://example.com/property',
      };

      const result = adapter.adapt(input);

      expect(result.description).toContain('https://example.com/property');
    });

    it('should handle missing caption gracefully', () => {
      const input = {
        propertyName: 'Test Villa',
      };

      const result = adapter.adapt(input);

      expect(result.title).toBeDefined();
      expect(result.title.length > 0).toBe(true);
    });

    it('should handle empty input gracefully', () => {
      const input = {};

      const result = adapter.adapt(input);

      expect(result.title).toBeDefined();
      expect(result.title.length > 0).toBe(true);
    });
  });

  describe('truncateText', () => {
    it('should not truncate short text', () => {
      const text = 'Short text';
      const result = adapter['truncateText'](text, 50);
      expect(result).toBe('Short text');
    });

    it('should truncate long text with ellipsis', () => {
      const text = 'a'.repeat(100);
      const result = adapter['truncateText'](text, 50);
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result).toContain('...');
    });

    it('should truncate at word boundary when possible', () => {
      const text = 'This is a long text that needs truncation';
      const result = adapter['truncateText'](text, 15);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('sanitizeCaption', () => {
    it('should remove @mentions', () => {
      const caption = 'Hello @john @jane this is great';
      const result = adapter['sanitizeCaption'](caption);
      expect(result).not.toContain('@');
    });

    it('should remove URLs', () => {
      const caption = 'Check out https://example.com and http://test.org for details';
      const result = adapter['sanitizeCaption'](caption);
      expect(result).not.toContain('https://');
      expect(result).not.toContain('http://');
    });

    it('should decode HTML entities', () => {
      const caption = 'Price is &quot;high&quot; &amp; worth it &lt;3';
      const result = adapter['sanitizeCaption'](caption);
      expect(result).toContain('"');
      expect(result).toContain('&');
      expect(result).toContain('<');
    });

    it('should preserve emojis', () => {
      const caption = 'Beautiful sunset 🌅 and ocean 🌊 vibes';
      const result = adapter['sanitizeCaption'](caption);
      expect(result).toContain('🌅');
      expect(result).toContain('🌊');
    });
  });
});
