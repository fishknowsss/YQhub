import { describe, expect, it } from 'vitest';
import { createAccountService, createMemorySecretVault } from './accountService';

describe('account service', () => {
  it('keeps user API key in the local vault and exposes only account metadata', () => {
    const vault = createMemorySecretVault();
    const service = createAccountService({ vault });
    const beforeCreate = Date.now() - 1000;

    const account = service.addAccount({
      name: '剪辑账号',
      apiKey: 'ak-localUserKey1234567890',
      concurrencyLimit: 1
    });

    expect(account).toMatchObject({
      name: '剪辑账号',
      apiKeyPreview: 'ak-...7890',
      apiKeyRef: expect.stringMatching(/^vault:/),
      concurrencyLimit: 1
    });
    expect(JSON.stringify(service.listAccounts())).not.toContain('ak-localUserKey1234567890');
    expect(service.getCredentials(account.id)).toMatchObject({
      accountId: account.id,
      apiKey: 'ak-localUserKey1234567890'
    });
    expect(Date.parse(account.createdAt)).toBeGreaterThanOrEqual(beforeCreate);
    expect(Date.parse(account.updatedAt)).toBeGreaterThanOrEqual(beforeCreate);
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

  it('deletes account metadata and removes its local secret', () => {
    const vault = createMemorySecretVault();
    const service = createAccountService({ vault });
    const account = service.addAccount({
      name: '待删除账号',
      apiKey: 'ak-deleteUserKey1234567890'
    });

    service.deleteAccount(account.id);

    expect(service.listAccounts()).toEqual([]);
    expect(() => vault.readSecret(account.apiKeyRef)).toThrow('密钥不存在');
  });

  it('rejects deleting an unknown account', () => {
    const service = createAccountService({ vault: createMemorySecretVault() });

    expect(() => service.deleteAccount('missing-account')).toThrow('账号不存在');
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

  it('loads account metadata saved by the previous credential shape', () => {
    const vault = createMemorySecretVault();
    const ref = vault.writeSecret('ak-migratedUserKey1234567890');
    const service = createAccountService({
      vault,
      initialAccounts: [
        {
          id: 'legacy-account',
          name: '旧账号',
          accessKeyPreview: 'ak-...7890',
          accessKeyRef: ref,
          concurrencyLimit: 1,
          enabled: true,
          createdAt: '2026-06-13T00:00:00.000Z',
          updatedAt: '2026-06-13T00:00:00.000Z'
        } as never
      ]
    });

    expect(service.listAccounts()[0]).toMatchObject({
      apiKeyPreview: 'ak-...7890',
      apiKeyRef: ref
    });
    expect(service.getCredentials('legacy-account').apiKey).toBe('ak-migratedUserKey1234567890');
  });

});
