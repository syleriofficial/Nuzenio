import { describe, it, expect } from 'vitest';
import {
  assignmentPayload,
  type IncomingArticle,
} from '@/lib/draft-assignment';

const article: IncomingArticle = {
  id: 'article',
  title: 'Fixture',
  excerpt: '',
  originalUrl: null,
  language: 'en',
  publisher: 'Fixture',
  version: 1,
  state: 'UNASSIGNED',
  clusterId: null,
  blockedReasons: [],
  approvalToken: 'a'.repeat(64),
};
describe('private draft assignment operations', () => {
  it('reuses exact uncertain retries without mutating the article', () => {
    const before = structuredClone(article);
    const first = assignmentPayload(article, null);
    expect(assignmentPayload(article, null, first)).toBe(first);
    expect(article).toEqual(before);
    expect(first.operationId).toMatch(/^[0-9a-f-]{36}$/);
  });
  it.each([{ version: 2 }, { approvalToken: 'b'.repeat(64) }])(
    'changes identity after refresh %s',
    (change) => {
      const first = assignmentPayload(article, null);
      expect(
        assignmentPayload({ ...article, ...change }, null, first).operationId,
      ).not.toBe(first.operationId);
    },
  );
  it('binds target and target version', () => {
    const target = {
      id: 'draft',
      title: 'Draft',
      version: 1,
      blockedReasons: [],
    };
    const first = assignmentPayload(article, target);
    expect(first.expectedClusterVersion).toBe(1);
    expect(
      assignmentPayload(article, { ...target, version: 2 }, first).operationId,
    ).not.toBe(first.operationId);
    expect(assignmentPayload(article, null, first).operationId).not.toBe(
      first.operationId,
    );
  });
  it.each([
    { blockedReasons: ['rights_revoked'] },
    { approvalToken: null },
    { state: 'ASSIGNED' as const },
  ])('rejects ineligible source %s', (change) => {
    expect(() => assignmentPayload({ ...article, ...change }, null)).toThrow();
  });
  it('rejects an already-authored target', () => {
    expect(() =>
      assignmentPayload(article, {
        id: 'draft',
        title: 'Draft',
        version: 2,
        blockedReasons: ['target_requires_editorial_workflow'],
      }),
    ).toThrow();
  });
});
