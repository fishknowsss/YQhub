import type {
  QueryVideoResponse,
  SubmitVideoRequest,
  SubmitVideoResponse,
  TaskStatus
} from './types';

interface StoredMockTask {
  taskId: string;
  accountId: string;
  pollCount: number;
}

export interface MockVideoApi {
  submit(request: SubmitVideoRequest): Promise<SubmitVideoResponse>;
  query(accountId: string, taskId: string): Promise<QueryVideoResponse>;
}

export function createMockVideoApi(): MockVideoApi {
  const tasks = new Map<string, StoredMockTask>();

  return {
    async submit(request) {
      const taskId = `mock-task-${tasks.size + 1}`;
      tasks.set(taskId, {
        taskId,
        accountId: request.accountId,
        pollCount: 0
      });

      return {
        taskId,
        status: 'in_queue'
      };
    },
    async query(accountId, taskId) {
      const task = tasks.get(taskId);

      if (!task) {
        throw new Error('任务不存在');
      }

      if (task.accountId !== accountId) {
        throw new Error('任务不属于当前账号');
      }

      task.pollCount += 1;

      return {
        taskId,
        accountId,
        status: getStatus(task.pollCount),
        progress: getProgress(task.pollCount),
        etaSeconds: getEta(task.pollCount),
        videoUrl:
          task.pollCount >= 4
            ? `https://example.com/generated/${encodeURIComponent(taskId)}.mp4`
            : null
      };
    }
  };
}

function getStatus(pollCount: number): TaskStatus {
  if (pollCount >= 4) {
    return 'done';
  }

  if (pollCount === 3) {
    return 'generating';
  }

  if (pollCount === 2) {
    return 'processing';
  }

  return 'in_queue';
}

function getProgress(pollCount: number): number {
  if (pollCount >= 4) {
    return 100;
  }

  return [18, 38, 72][pollCount - 1] ?? 10;
}

function getEta(pollCount: number): number | null {
  if (pollCount >= 4) {
    return 0;
  }

  return [90, 55, 24][pollCount - 1] ?? null;
}
