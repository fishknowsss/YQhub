import type { ApiAccount, ApiAccountInput } from '../../domain/types';
import { maskApiKey } from '../../domain/state';

export interface ApiCredentials {
  accountId: string;
  apiKey: string;
  relayEndpoint: string;
}

export interface SecretVault {
  writeSecret(secret: string): string;
  readSecret(ref: string): string;
  deleteSecret(ref: string): void;
}

export interface AccountService {
  addAccount(input: ApiAccountInput): ApiAccount;
  listAccounts(): ApiAccount[];
  getAccount(accountId: string): ApiAccount;
  getCredentials(accountId: string): ApiCredentials;
  deleteAccount(accountId: string): void;
}

export interface CreateAccountServiceOptions {
  vault: SecretVault;
  initialAccounts?: ApiAccount[];
}

const DEFAULT_RELAY_ENDPOINT = process.env.YQHUB_RELAY_URL ?? 'https://relay.yqhub.local';
const FIXED_TIME = '2026-06-13T00:00:00.000Z';
let vaultSequence = 0;

export function createAccountService({
  vault,
  initialAccounts = []
}: CreateAccountServiceOptions): AccountService {
  let accounts = [...initialAccounts];

  return {
    addAccount(input) {
      const account: ApiAccount = {
        id: `account-${accounts.length + 1}`,
        name: input.name.trim() || '未命名账号',
        apiKeyPreview: maskApiKey(input.apiKey),
        apiKeyRef: vault.writeSecret(input.apiKey.trim()),
        relayEndpoint: input.relayEndpoint ?? DEFAULT_RELAY_ENDPOINT,
        concurrencyLimit: input.concurrencyLimit ?? 1,
        enabled: true,
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME
      };

      accounts = [...accounts, account];
      return account;
    },
    listAccounts() {
      return accounts.map((account) => ({ ...account }));
    },
    getAccount(accountId) {
      const account = accounts.find((candidate) => candidate.id === accountId);

      if (!account) {
        throw new Error('账号不存在');
      }

      return { ...account };
    },
    getCredentials(accountId) {
      const account = this.getAccount(accountId);

      return {
        accountId: account.id,
        apiKey: vault.readSecret(account.apiKeyRef),
        relayEndpoint: account.relayEndpoint
      };
    },
    deleteAccount(accountId) {
      const account = this.getAccount(accountId);
      accounts = accounts.filter((candidate) => candidate.id !== accountId);
      vault.deleteSecret(account.apiKeyRef);
    }
  };
}

export function createMemorySecretVault(): SecretVault {
  const secrets = new Map<string, string>();
  vaultSequence += 1;
  const vaultId = `memory-${vaultSequence}`;

  return {
    writeSecret(secret) {
      const ref = `vault:${vaultId}:${secrets.size + 1}`;
      secrets.set(ref, secret);
      return ref;
    },
    readSecret(ref) {
      const secret = secrets.get(ref);

      if (secret === undefined) {
        throw new Error('密钥不存在');
      }

      return secret;
    },
    deleteSecret(ref) {
      secrets.delete(ref);
    }
  };
}
