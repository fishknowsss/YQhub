import type { GenerationTask, TaskStatus } from '../../domain/types';
import { isKnownSubmitModelId } from '../../shared/modelCapabilities';
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
      if (!isKnownSubmitModelId(task.model)) {
        throw new Error('模型不存在');
      }

      const credentials = accountService.getCredentials(task.accountId);
      let result: SubmitTaskResult;

      try {
        result = await client.submitTask({
          credentials,
          task
        });
      } catch (error) {
        throw new Error(normalizeSubmitErrorMessage(error));
      }

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

function normalizeSubmitErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');

  if (isTransportErrorMessage(message)) {
    return '网络连接失败，请稍后重试';
  }

  return message.trim() || '提交生成失败';
}

function isTransportErrorMessage(message: string): boolean {
  return /fetch failed|network|ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR/iu.test(message);
}
