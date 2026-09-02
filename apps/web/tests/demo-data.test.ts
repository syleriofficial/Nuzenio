import { describe, expect, it } from 'vitest';
import { storyClusters } from '@/lib/demo-data';

describe('demonstration story clusters', () => {
  it('keeps briefs within the promised 40–80 word range', () => {
    for (const story of storyClusters) {
      const wordCount = story.brief.trim().split(/\s+/).length;
      expect(wordCount, story.slug).toBeGreaterThanOrEqual(40);
      expect(wordCount, story.slug).toBeLessThanOrEqual(80);
    }
  });

  it('counts publisher organisations rather than article URLs', () => {
    for (const story of storyClusters) {
      const organisations = new Set(
        story.sources
          .filter((source) => !source.isSyndicated)
          .map((source) => source.organization),
      );
      expect(story.independentSourceCount, story.slug).toBe(organisations.size);
    }
  });

  it('requires reviewed state for high-risk demonstration stories', () => {
    for (const story of storyClusters.filter(
      (item) => item.riskLevel === 'HIGH',
    )) {
      expect(story.reviewState, story.slug).toBe('EDITOR_REVIEWED');
    }
  });

  it('never labels a story disputed without showing the disputed claim', () => {
    for (const story of storyClusters.filter(
      (item) => item.status === 'DISPUTED',
    )) {
      expect(story.disputed.length, story.slug).toBeGreaterThan(0);
      expect(story.disputedHi.length, story.slug).toBeGreaterThan(0);
    }
  });

  it('includes clusters with primary documents', () => {
    expect(storyClusters.some((story) => story.primaryDocument)).toBe(true);
  });
});
