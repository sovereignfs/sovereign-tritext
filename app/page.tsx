import Link from 'next/link';
import { sdk } from '@sovereignfs/sdk';
import { Card, EmptyState, PageHeader } from '@sovereignfs/ui';
import { CreateProjectForm } from './_components/CreateProjectForm';
import { listProjects } from './actions';
import styles from './tritext.module.css';

export default async function TritextPage() {
  await sdk.auth.requireSession();
  const projects = await listProjects();

  return (
    <div className={styles.page}>
      <PageHeader title="Tritext" description="Trilingual content and translation projects." />
      <CreateProjectForm />
      {projects.length === 0 ? (
        <EmptyState
          heading="No projects yet"
          description="Create your first trilingual content project above."
        />
      ) : (
        <ul className={styles.projectList}>
          {projects.map((project) => (
            <li key={project.id}>
              <Link href={`/tritext/${project.id}`} className={styles.projectLink}>
                <Card as="article" interactive>
                  <h2 className={styles.projectTitle}>{project.title}</h2>
                  {project.description && (
                    <p className={styles.projectDescription}>{project.description}</p>
                  )}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
