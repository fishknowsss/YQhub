import { describe, expect, it } from 'vitest';
import { createAccountService, createMemorySecretVault } from './accountService';

describe('account service', () => {
  it('keeps user API key in the local vault and exposes only account metadata', () => {
    const vault = createMemorySecretVault();
    const service = createAccountService({ vault });

    const account = service.addAccount({
      name: '剪辑账号',
      apiKey: 'ak-local-user-key',
      relayEndpoint: 'https://relay.example.com',
      concurrencyLimit: 1
    });

    expect(account).toMatchObject({
      name: '剪辑账号',
      apiKeyPreview: 'ak-...-key',
      apiKeyRef: expect.stringMatching(/^vault:/),
      relayEndpoint: 'https://relay.example.com',
      concurrencyLimit: 1
    });
    expect(JSON.stringify(service.listAccounts())).not.toContain('ak-local-user-key');
    expect(service.getCredentials(account.id)).toMatchObject({
      accountId: account.id,
      apiKey: 'ak-local-user-key',
      relayEndpoint: 'https://relay.example.com'
    });
  });

  it('does not share secrets between different local vaults', () => {
    const firstVault = createMemorySecretVault();
    const secondVault = createMemorySecretVault();
    const firstUser = createAccountService({ vault: firstVault });
    const secondUser = createAccountService({ vault: secondVault });

    const firstAccount = firstUser.addAccount({
      name: '用户一',
      apiKey: 'ak-one'
    });
    secondUser.addAccount({
      name: '用户二',
      apiKey: 'ak-two'
    });

    expect(firstVault.readSecret(firstAccount.apiKeyRef)).toBe('ak-one');
    expect(() => secondVault.readSecret(firstAccount.apiKeyRef)).toThrow('密钥不存在');
  });
});
