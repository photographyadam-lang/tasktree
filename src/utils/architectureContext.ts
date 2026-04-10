import type { TaskNode, ArchitectureContext } from '../types';

const FIELD_LABELS: Array<{ key: keyof ArchitectureContext; label: string }> = [
  { key: 'stack',               label: 'Stack' },
  { key: 'auth_pattern',        label: 'Auth Pattern' },
  { key: 'deployment_target',   label: 'Deployment' },
  { key: 'key_constraints',     label: 'Key Constraints' },
  { key: 'naming_conventions',  label: 'Naming Conventions' },
  { key: 'claude_rules',        label: 'Rules' },
];

export function getArchitectureContext(projectNode: TaskNode): string {
  const arch = projectNode.architecture;
  if (!arch) return '';

  const lines = FIELD_LABELS
    .map(({ key, label }) => {
      const val = arch[key]?.trim();
      return val ? `${label}: ${val}` : '';
    })
    .filter(Boolean);

  if (lines.length === 0) return '';
  return `## Architecture Context\n${lines.join('\n')}`;
}
