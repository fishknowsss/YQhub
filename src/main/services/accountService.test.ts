import { afterEach, describe, expect, it } from 'vitest';
import { createAccountService, createMemorySecretVault } from './accountService';

const previousRelayUrl = process.env.YQHUB_RELAY_URL;

afterEach(() => {
  if (previousRelayUrl === undefined) {
    delete process.env.YQHUB_RELAY_URL;
    return;
  }

  process.env.YQHUB_RELAY_URL = previousRelayUrl;
});

describe('account service', () => {
  it('keeps user API key in the local vault and exposes only account metadata', () => {
    const vault = createMemorySecretVault();
    const service = createAccountService({ vault });

    const account = service.addAccount({
      name: '剪辑账号',
      apiKey: 'ak-localUserKey1234567890',
      relayEndpoint: 'https://relay.example.com',
      concurrencyLimit: 1
    });

    expect(account).toMatchObject({
      name: '剪辑账号',
      apiKeyPreview: 'ak-...7890',
      apiKeyRef: expect.stringMatching(/^vault:/),
      relayEndpoint: 'https://relay.example.com',
      concurrencyLimit: 1
    });
    expect(JSON.stringify(service.listAccounts())).not.toContain('ak-localUserKey1234567890');
    expect(service.getCredentials(account.id)).toMatchObject({
      accountId: account.id,
      apiKey: 'ak-localUserKey1234567890',
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
      apiKey: 'ak-oneUserKey1234567890'
    });
    secondUser.addAccount({
      name: '用户二',
      apiKey: 'ak-twoUserKey1234567890'
    });

    expect(firstVault.readSecret(firstAccount.apiKeyRef)).toBe('ak-oneUserKey1234567890');
    expect(() => secondVault.readSecret(firstAccount.apiKeyRef)).toThrow('密钥不存在');
  });

  it('rejects non-ak API keys before writing the vault', () => {
    const vault = createMemorySecretVault();
    const service = createAccountService({ vault });

    expect(() =>
      service.addAccount({
        name: '错误账号',
        apiKey: 'sk-localUserKey1234567890'
      })
    ).toThrow('只支持小云雀官网发放的 ak- API Key');
    expect(service.listAccounts()).toEqual([]);
  });

  it('uses the configured relay URL when account input does not include one', () => {
    process.env.YQHUB_RELAY_URL = 'https://relay.yqhub.example.com';
    const service = createAccountService({ vault: createMemorySecretVault() });

    const account = service.addAccount({
      name: '剪辑账号',
      apiKey: 'ak-localUserKey1234567890'
    });

    expect(account.relayEndpoint).toBe('https://relay.yqhub.example.com');
  });
});
