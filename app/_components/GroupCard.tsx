'use client';

import { useActionState, useEffect, useState } from 'react';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Button,
  ConfirmDialog,
  DragHandleRow,
  EmptyState,
  Icon,
  Input,
  useCommitOnEnterOrBlur,
  useToast,
} from '@sovereignfs/ui';
import type { BlockSummary } from '../_lib/blockSummary';
import { createBlockAction, type CreateBlockResult } from '../blocks-actions';
import {
  deleteGroupAction,
  renameGroupAction,
  reorderBlocksAction,
  type SimpleResult,
  toggleGroupCollapsedAction,
} from '../groups-actions';
import { useReorderSensors } from '../_lib/dndSensors';
import { BlockRow } from './BlockRow';
import styles from '../tritext.module.css';

export interface GroupCardData {
  id: string;
  name: string;
  isCollapsed: boolean;
  blocks: BlockSummary[];
}

export function GroupCard({
  projectId,
  group,
  groupOptions,
  canEdit,
  onChanged,
}: {
  projectId: string;
  group: GroupCardData;
  groupOptions: { id: string; name: string }[];
  canEdit: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    disabled: !canEdit,
  });
  const sensors = useReorderSensors();

  const [collapsed, setCollapsed] = useState(group.isCollapsed);
  useEffect(() => setCollapsed(group.isCollapsed), [group.isCollapsed]);

  const [name, setName] = useState(group.name);
  useEffect(() => setName(group.name), [group.name]);
  const commitRename = useCommitOnEnterOrBlur(() => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === group.name) {
      setName(group.name);
      return;
    }
    const formData = new FormData();
    formData.set('projectId', projectId);
    formData.set('groupId', group.id);
    formData.set('name', trimmed);
    void renameGroupAction(null, formData).then((result) => {
      if (!result.ok) {
        toast.show({ title: result.error, category: 'error' });
        setName(group.name);
      } else {
        onChanged();
      }
    });
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);

  const [addState, addAction, addPending] = useActionState<CreateBlockResult | null, FormData>(
    createBlockAction,
    null,
  );
  useEffect(() => {
    if (addState && !addState.ok) toast.show({ title: addState.error, category: 'error' });
  }, [addState, toast]);

  async function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    await toggleGroupCollapsedAction(projectId, group.id, next);
  }

  async function confirmDelete() {
    setDeletePending(true);
    const formData = new FormData();
    formData.set('projectId', projectId);
    formData.set('groupId', group.id);
    const result: SimpleResult = await deleteGroupAction(null, formData);
    setDeletePending(false);
    setDeleteOpen(false);
    if (!result.ok) {
      toast.show({ title: result.error, category: 'error' });
      return;
    }
    onChanged();
  }

  async function handleBlockDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = group.blocks.findIndex((b) => b.id === active.id);
    const newIndex = group.blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(group.blocks, oldIndex, newIndex).map((b) => b.id);
    await reorderBlocksAction(projectId, group.id, reordered);
    onChanged();
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={styles.groupCard}
    >
      <DragHandleRow
        isDragging={isDragging}
        handleProps={canEdit ? { ...attributes, ...listeners } : undefined}
      >
        <div className={styles.groupHeaderContent}>
          <button
            type="button"
            className={styles.collapseToggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand "${group.name}"` : `Collapse "${group.name}"`}
            onClick={toggleCollapsed}
          >
            <Icon name={collapsed ? 'chevron-right' : 'chevron-down'} size="sm" aria-hidden />
          </button>
          {canEdit ? (
            <Input
              value={name}
              aria-label="Group name"
              className={styles.groupNameInput}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={commitRename.onKeyDown}
              onBlur={commitRename.onBlur}
            />
          ) : (
            <span className={styles.groupName}>{group.name}</span>
          )}
          <span className={styles.blockCount}>
            {group.blocks.length} {group.blocks.length === 1 ? 'block' : 'blocks'}
          </span>
          {canEdit && (
            <button
              type="button"
              className={styles.deleteGroupButton}
              aria-label={`Delete "${group.name}"`}
              onClick={() => setDeleteOpen(true)}
            >
              <Icon name="trash-2" size="sm" aria-hidden />
            </button>
          )}
        </div>
      </DragHandleRow>

      {!collapsed && (
        <div className={styles.groupBody}>
          <DndContext
            id={`group-${group.id}-dnd`}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => void handleBlockDragEnd(event)}
          >
            <SortableContext
              items={group.blocks.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className={styles.blockList}>
                {group.blocks.map((block) => (
                  <BlockRow
                    key={block.id}
                    projectId={projectId}
                    block={block}
                    groupOptions={groupOptions}
                    canEdit={canEdit}
                    onMoved={onChanged}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          {group.blocks.length === 0 && (
            <EmptyState heading="No blocks yet" description="Add a block to this group below." />
          )}
          {canEdit && (
            <form action={addAction} className={styles.addBlockForm}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="groupId" value={group.id} />
              <Button type="submit" variant="secondary" size="sm" disabled={addPending}>
                {addPending ? 'Adding…' : 'Add block'}
              </Button>
            </form>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        title="Delete group"
        message={
          <>
            Delete "{group.name}"? Its blocks move back to Ungrouped — nothing is deleted.
          </>
        }
        confirmLabel={deletePending ? 'Deleting…' : 'Delete group'}
        pending={deletePending}
        destructive
      />
    </div>
  );
}
