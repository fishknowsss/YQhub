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
    expect(previewStage).toContain('max-width: min(100%, 298px)');
    expect(previewColumn).toContain('minmax(184px, 230px)');
    expect(currentTaskPanel).toContain('min-height: 184px');
    expect(currentTaskPanel).not.toContain('max-height: 156px');
  });
});
