import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync('src/styles.css', 'utf8');

function cssBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escaped}\\s*\\{(?<body>[\\s\\S]*?)\\n\\}`, 'u'));

  return match?.groups?.body ?? '';
}

describe('layout CSS', () => {
  it('keeps the video preview from crowding the controls and current task area', () => {
    const previewStage = cssBlock('.preview-stage');
    const currentTaskPanel = cssBlock('.current-task-panel');
    const previewColumn = cssBlock('.preview-column');

    expect(previewStage).toContain('width: auto');
    expect(previewStage).toContain('height: min(100%, 530px)');
    expect(previewStage).toContain('max-width: min(100%, 560px)');
    expect(previewStage).toContain('aspect-ratio: var(--preview-aspect, 9 / 16)');
    expect(previewColumn).toContain('minmax(184px, 230px)');
    expect(currentTaskPanel).toContain('min-height: 184px');
    expect(currentTaskPanel).not.toContain('max-height: 156px');
  });

  it('keeps current task rows readable and scrolls overflow tasks', () => {
    const taskList = cssBlock('.task-list');
    const taskItem = cssBlock('.task-item');

    expect(taskList).toContain('min-height: 0');
    expect(taskList).toContain('overflow-y: auto');
    expect(taskList).toContain('grid-auto-rows: minmax(96px, max-content)');
    expect(taskItem).toContain('min-height: 96px');
    expect(styles).not.toContain('.task-list {\n    max-height: none;\n    overflow: visible;');
  });
});
