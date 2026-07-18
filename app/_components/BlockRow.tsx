'use client';

import Link from 'next/link';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DragHandleRow, Icon, Select } from '@sovereignfs/ui';
import type { BlockSummary } from '../_lib/blockSummary';
import { type BlockStatus, STATUS_LABEL } from '../_lib/blockStatus';
import { moveBlockToGroupAction } from '../groups-actions';
import styles from '../tritext.module.css';

export function BlockRow({
  projectId,
  block,
  groupOptions,
  canEdit,
  onMoved,
}: {
  projectId: string;
  block: BlockSummary;
  /** Every group in the project, for the "Move to" select. */
  groupOptions: { id: string; name: string }[];
  canEdit: boolean;
  onMoved: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: !canEdit,
  });

  async function handleMove(groupId: string) {
    await moveBlockToGroupAction(projectId, block.id, groupId || null);
    onMoved();
  }

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <DragHandleRow
        isDragging={isDragging}
        handleProps={canEdit ? { ...attributes, ...listeners } : undefined}
      >
        <div className={styles.blockRowContent}>
          <Link href={`/tritext/${projectId}/blocks/${block.id}`} className={styles.blockLink}>
            <p className={styles.blockPreview}>{block.preview}</p>
            <p className={styles.blockMeta}>
              Status: {STATUS_LABEL[block.status as BlockStatus] ?? block.status}
              {block.issueCount > 0 && (
                <span className={styles.issueBadge}>
                  <Icon name="alert-triangle" size="xs" aria-hidden />
                  {block.issueCount} {block.issueCount === 1 ? 'issue' : 'issues'}
                </span>
              )}
            </p>
          </Link>
          {canEdit && groupOptions.length > 0 && (
            <Select
              size="sm"
              aria-label={`Move "${block.preview}" to a different group`}
              value={block.groupId ?? ''}
              onChange={(e) => void handleMove(e.target.value)}
              className={styles.moveSelect}
            >
              <option value="">Ungrouped</option>
              {groupOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </DragHandleRow>
    </div>
  );
}
