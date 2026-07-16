'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { closestCenter, DndContext, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button, EmptyState, Input, useToast } from '@sovereignfs/ui';
import { createBlockAction, type CreateBlockResult } from '../blocks-actions';
import {
  createGroupAction,
  type GroupActionResult,
  type ProjectContent,
  reorderBlocksAction,
  reorderGroupsAction,
} from '../groups-actions';
import { useReorderSensors } from '../_lib/dndSensors';
import { BlockRow } from './BlockRow';
import { GroupCard } from './GroupCard';
import styles from '../tritext.module.css';

export function ProjectContentView({
  projectId,
  initialContent,
  canEdit,
}: {
  projectId: string;
  initialContent: ProjectContent;
  canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const sensors = useReorderSensors();

  // Drag reorder updates this locally for instant feedback; every mutation
  // (rename, delete, move, add) instead calls router.refresh() and lets a
  // fresh `initialContent` prop resync it — see the effect below.
  const [content, setContent] = useState(initialContent);
  useEffect(() => setContent(initialContent), [initialContent]);

  function refresh() {
    router.refresh();
  }

  const groupOptions = content.groups.map((g) => ({ id: g.id, name: g.name }));

  const [groupName, setGroupName] = useState('');
  const [groupState, groupAction, groupPending] = useActionState<
    GroupActionResult | null,
    FormData
  >(createGroupAction, null);
  useEffect(() => {
    if (!groupState) return;
    if (groupState.ok) {
      setGroupName('');
      router.refresh();
    } else {
      toast.show({ title: groupState.error, category: 'error' });
    }
  }, [groupState, router, toast]);

  const [blockState, blockAction, blockPending] = useActionState<
    CreateBlockResult | null,
    FormData
  >(createBlockAction, null);
  useEffect(() => {
    if (!blockState) return;
    if (blockState.ok) {
      router.refresh();
    } else {
      toast.show({ title: blockState.error, category: 'error' });
    }
  }, [blockState, router, toast]);

  async function handleGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = content.groups.findIndex((g) => g.id === active.id);
    const newIndex = content.groups.findIndex((g) => g.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(content.groups, oldIndex, newIndex);
    setContent((prev) => ({ ...prev, groups: reordered }));
    await reorderGroupsAction(
      projectId,
      reordered.map((g) => g.id),
    );
    refresh();
  }

  async function handleUngroupedDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = content.ungroupedBlocks.findIndex((b) => b.id === active.id);
    const newIndex = content.ungroupedBlocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(content.ungroupedBlocks, oldIndex, newIndex);
    setContent((prev) => ({ ...prev, ungroupedBlocks: reordered }));
    await reorderBlocksAction(
      projectId,
      null,
      reordered.map((b) => b.id),
    );
    refresh();
  }

  const isEmpty = content.groups.length === 0 && content.ungroupedBlocks.length === 0;

  return (
    <section className={styles.blocksSection}>
      <div className={styles.blocksSectionHeader}>
        <h2 className={styles.sectionTitle}>Content</h2>
      </div>

      {canEdit && (
        <div className={styles.addControls}>
          <form action={groupAction} className={styles.inlineForm}>
            <input type="hidden" name="projectId" value={projectId} />
            <Input
              name="name"
              placeholder="New group name…"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              aria-label="New group name"
            />
            <Button type="submit" variant="secondary" size="sm" disabled={groupPending}>
              {groupPending ? 'Adding…' : 'Add group'}
            </Button>
          </form>
          <form action={blockAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <Button type="submit" size="sm" disabled={blockPending}>
              {blockPending ? 'Adding…' : 'Add ungrouped block'}
            </Button>
          </form>
        </div>
      )}

      {isEmpty ? (
        <EmptyState
          heading="No content yet"
          description={
            canEdit
              ? 'Add a group or a block above.'
              : 'Nothing has been added to this project yet.'
          }
        />
      ) : (
        <>
          {content.groups.length > 0 && (
            <DndContext
              id="groups-dnd"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(event) => void handleGroupDragEnd(event)}
            >
              <SortableContext
                items={content.groups.map((g) => g.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={styles.groupList}>
                  {content.groups.map((group) => (
                    <GroupCard
                      key={group.id}
                      projectId={projectId}
                      group={group}
                      groupOptions={groupOptions}
                      canEdit={canEdit}
                      onChanged={refresh}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {(content.ungroupedBlocks.length > 0 || content.groups.length === 0) && (
            <div className={styles.ungroupedSection}>
              {content.groups.length > 0 && (
                <h3 className={styles.sectionSubtitle}>Ungrouped</h3>
              )}
              <DndContext
                id="ungrouped-dnd"
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => void handleUngroupedDragEnd(event)}
              >
                <SortableContext
                  items={content.ungroupedBlocks.map((b) => b.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className={styles.blockList}>
                    {content.ungroupedBlocks.map((block) => (
                      <BlockRow
                        key={block.id}
                        projectId={projectId}
                        block={block}
                        groupOptions={groupOptions}
                        canEdit={canEdit}
                        onMoved={refresh}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </>
      )}
    </section>
  );
}
