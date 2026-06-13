import type { GenerationTask, TaskStatus } from '../../domain/types';
import type { GetTaskResult, SubmitTaskInput, SubmitTaskResult } from '../../services/volcengineClient';
import type { AccountService } from './accountService';
import type { DownloadService } from './downloadService';

export interface VideoTaskClient {
  submitTask(input: SubmitTaskInput): Promise<SubmitTaskResult>;
  getTaskResult(input: {
    credentials: SubmitTaskInput['credentials'];
    apiTaskId: string;
  }): Promise<GetTaskResult>;
}

export interface TaskService {
  refreshTask(task: GenerationTask): Promise<GenerationTask>;
}

export interface CreateTaskServiceOptions {
  accountService: AccountService;
  client: VideoTaskClient;
  downloadService: DownloadService;
}

export function createTaskService({
  accountService,
  client,
  downloadService
}: CreateTaskServiceOptions): TaskService {
  return {
    async refreshTask(task) {
      if (!task.apiTaskId) {
        throw new Error('任务还没有远端 task_id');
      }

      const credentials = accountService.getCredentials(task.accountId);
      const result = await client.getTaskResult({
        credentials,
        apiTaskId: task.apiTaskId
      });
      const progress = mapProgress(result.status);
      const status = mapStatus(result.status);
      const nextTask: GenerationTask = {
        ...task,
        status,
        progress,
        etaSeconds: status === 'done' ? 0 : task.etaSeconds,
        videoUrl: result.videoUrl,
        requestId: result.requestId,
        updatedAt: new Date(0).toISOString()
      };

      if (status === 'done' && result.videoUrl) {
        return {
          ...nextTask,
          localVideoPath: await downloadService.downloadGeneratedVideo({
            taskId: task.apiTaskId,
            videoUrl: result.videoUrl
          })
        };
      }

      return nextTask;
    }
  };
}

function mapStatus(status: GetTaskResult['status']): TaskStatus {
  if (status === 'not_found' || status === 'expired') {
    return status;
  }

  return status;
}

function mapProgress(status: GetTaskResult['status']): number {
  const progressMap: Record<GetTaskResult['status'], number> = {
    in_queue: 18,
    processing: 35,
    generating: 72,
    done: 100,
    not_found: 0,
    expired: 0
  };

  return progressMap[status];
}
