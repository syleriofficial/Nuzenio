import { newSubmissionId } from '@/lib/reader-report';

export interface IncomingArticle {
  id: string;
  title: string | null;
  excerpt: string | null;
  originalUrl: string | null;
  publisher: string;
  language: string;
  version: number;
  state: 'UNASSIGNED' | 'ASSIGNED';
  clusterId: string | null;
  blockedReasons: string[];
  approvalToken: string | null;
}
export interface DraftTarget {
  id: string;
  title: string;
  version: number;
  blockedReasons: string[];
}
export interface AssignmentPayload {
  operationId: string;
  expectedArticleVersion: number;
  approvalToken: string;
  targetClusterId: string | null;
  expectedClusterVersion: number | null;
}

// Memory only, owned by one mounted staff-session component. Uncertain retries
// reuse the identical operation; any viewed version/approval/target change does not.
export function assignmentPayload(
  article: IncomingArticle,
  target: DraftTarget | null,
  previous?: AssignmentPayload,
): AssignmentPayload {
  if (
    article.state !== 'UNASSIGNED' ||
    article.blockedReasons.length ||
    !article.approvalToken ||
    target?.blockedReasons.length
  )
    throw new Error('Refresh the inbox and select an eligible draft.');
  const fields = {
    expectedArticleVersion: article.version,
    approvalToken: article.approvalToken,
    targetClusterId: target?.id ?? null,
    expectedClusterVersion: target?.version ?? null,
  };
  if (
    previous &&
    Object.entries(fields).every(
      ([key, value]) => previous[key as keyof AssignmentPayload] === value,
    )
  )
    return previous;
  return { operationId: newSubmissionId(), ...fields };
}
