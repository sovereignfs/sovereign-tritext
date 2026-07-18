import { describe, expect, it } from 'vitest';
import { aggregateStatus } from '../blockStatus';

describe('aggregateStatus', () => {
  it('returns approved when every language is approved', () => {
    expect(aggregateStatus(['approved', 'approved', 'approved'])).toBe('approved');
  });

  it('returns the least-advanced status among enabled languages', () => {
    expect(aggregateStatus(['approved', 'draft', 'approved'])).toBe('draft');
    expect(aggregateStatus(['approved', 'in_review', 'approved'])).toBe('in_review');
  });

  it('returns approved for an empty language list (vacuous best case)', () => {
    expect(aggregateStatus([])).toBe('approved');
  });

  it('is order-independent', () => {
    expect(aggregateStatus(['draft', 'approved', 'in_review'])).toBe('draft');
    expect(aggregateStatus(['in_review', 'draft', 'approved'])).toBe('draft');
  });
});
