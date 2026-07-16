'use client';

import { useActionState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Card, EmptyState, useToast } from '@sovereignfs/ui';
import { type BlockSummary, type CreateBlockResult, createBlockAction } from '../blocks-actions';
import styles from '../tritext.module.css';

export function BlocksSection({
  projectId,
  blocks,
  canAddBlocks,
}: {
  projectId: string;
  blocks: BlockSummary[];
  canAddBlocks: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [state, action, pending] = useActionState<CreateBlockResult | null, FormData>(
    createBlockAction,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      router.push(`/tritext/${projectId}/blocks/${state.blockId}`);
    } else {
      toast.show({ title: state.error, category: 'error' });
    }
  }, [state, toast, router, projectId]);

  return (
    <section className={styles.blocksSection}>
      <div className={styles.blocksSectionHeader}>
        <h2 className={styles.sectionTitle}>Blocks</h2>
        {canAddBlocks && (
          <form action={action}>
            <input type="hidden" name="projectId" value={projectId} />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Adding…' : 'Add block'}
            </Button>
          </form>
        )}
      </div>
      {blocks.length === 0 ? (
        <EmptyState
          heading="No blocks yet"
          description={
            canAddBlocks
              ? 'Add your first content block above.'
              : 'Nothing has been added to this project yet.'
          }
        />
      ) : (
        <ul className={styles.blockList}>
          {blocks.map((block) => (
            <li key={block.id}>
              <Link
                href={`/tritext/${projectId}/blocks/${block.id}`}
                className={styles.blockLink}
              >
                <Card as="article" interactive>
                  <p className={styles.blockPreview}>{block.preview}</p>
                  <p className={styles.blockMeta}>Status: {block.status}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
