import type { GenerationTask, TaskStatus } from '../../domain/types';
import { isModelId } from '../../shared/modelCapabilities';
import type { ApiCredentials, AccountService } from './accountService';

export interface SubmitTaskInput {
  credentials: ApiCredentials;
  task: GenerationTask;
}

export interface SubmitTaskResult {
  apiTaskId: string;
  requestId: string;
  status: TaskStatus;
}

export interface VideoClient {
  submitTask(input: SubmitTaskInput): Promise<SubmitTaskResult>;
}

export interface QueueService {
  submit(task: GenerationTask, currentAccountId?: string): Promise<GenerationTask>;
}

export interface CreateQueueServiceOptions {
  accountService: AccountService;
  client: VideoClient;
}

export function createQueueService({
  accountService,
  client
}: CreateQueueServiceOptions): QueueService {
  return {
    async submit(task) {
      if (!isModelId(task.model)) {
        throw new Error('模型不存在');
      }

      const credentials = accountService.getCredentials(task.accountId);
      const result = await client.submitTask({
        credentials,
        task
      });

      return {
        ...task,
        apiTaskId: result.apiTaskId,
        requestId: result.requestId,
        status: result.status,
        updatedAt: new Date().toISOString()
      };
    }
  };
}
