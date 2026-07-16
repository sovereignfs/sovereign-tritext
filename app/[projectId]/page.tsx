import { notFound } from 'next/navigation';
import { sdk } from '@sovereignfs/sdk';
import { PageHeader } from '@sovereignfs/ui';
import { ProjectSettingsForm } from '../_components/ProjectSettingsForm';
import { getProject } from '../actions';
import styles from '../tritext.module.css';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  await sdk.auth.requireSession();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();

  return (
    <div className={styles.page}>
      <PageHeader title={project.title} description={project.description ?? undefined} />
      <ProjectSettingsForm project={project} />
    </div>
  );
}
