import { notFound } from 'next/navigation';
import { sdk } from '@sovereignfs/sdk';
import { PageHeader } from '@sovereignfs/ui';
import { MembersSection } from '../_components/MembersSection';
import { ProjectContentView } from '../_components/ProjectContentView';
import { ProjectSettingsForm } from '../_components/ProjectSettingsForm';
import { getProject } from '../actions';
import { getProjectContent } from '../groups-actions';
import { getProjectMembers } from '../members-actions';
import styles from '../tritext.module.css';

interface Props {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  await sdk.auth.requireSession();
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();
  const content = await getProjectContent(projectId);
  if (!content) notFound();
  const projectMembers = await getProjectMembers(projectId);
  if (!projectMembers) notFound();

  return (
    <div className={styles.page}>
      <PageHeader title={project.title} description={project.description ?? undefined} />
      <ProjectContentView
        projectId={projectId}
        initialContent={content}
        canEdit={project.viewerRole !== 'viewer'}
      />
      <MembersSection
        projectId={projectId}
        owner={projectMembers.owner}
        members={projectMembers.members}
        canManage={projectMembers.canManage}
        directoryLookupFailed={projectMembers.directoryLookupFailed}
      />
      <ProjectSettingsForm project={project} />
    </div>
  );
}
