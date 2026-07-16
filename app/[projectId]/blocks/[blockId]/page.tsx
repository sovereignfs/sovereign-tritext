import { notFound } from 'next/navigation';
import Link from 'next/link';
import { sdk } from '@sovereignfs/sdk';
import { PageHeader } from '@sovereignfs/ui';
import { BlockEditorView } from '../../../_components/BlockEditorView';
import { getBlock } from '../../../blocks-actions';
import styles from '../../../tritext.module.css';

interface Props {
  params: Promise<{ projectId: string; blockId: string }>;
}

export default async function BlockEditorPage({ params }: Props) {
  await sdk.auth.requireSession();
  const { projectId, blockId } = await params;
  const block = await getBlock(projectId, blockId);
  if (!block) notFound();

  return (
    <div className={styles.blockEditorPage}>
      <PageHeader
        title="Edit block"
        action={
          <Link href={`/tritext/${projectId}`} className={styles.backLink}>
            ← Back to project
          </Link>
        }
      />
      <BlockEditorView block={block} />
    </div>
  );
}
