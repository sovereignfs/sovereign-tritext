/**
 * Shared by `blocks-actions.ts` (`'use server'`) and presentational
 * components. Next.js requires every export of a `'use server'` file to be
 * an async function, so this plain constant/type/helper set can't live
 * there — see CLAUDE.md's Decision Log entry on `blockSummary.ts` for the
 * same constraint.
 */

export type BlockStatus = 'draft' | 'in_review' | 'approved';

export const BLOCK_STATUSES: BlockStatus[] = ['draft', 'in_review', 'approved'];

export const STATUS_LABEL: Record<BlockStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
};

/** A block's overall status is only as advanced as its least-advanced enabled language. */
export function aggregateStatus(statuses: BlockStatus[]): BlockStatus {
  return statuses.reduce<BlockStatus>((worst, status) => {
    return BLOCK_STATUSES.indexOf(status) < BLOCK_STATUSES.indexOf(worst) ? status : worst;
  }, 'approved');
}
