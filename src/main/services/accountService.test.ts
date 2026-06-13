import { describe, expect, it } from 'vitest';
import { createAccountService, createMemorySecretVault } from './accountService';

describe('account service', () => {
  it('keeps Secret Access Key in the local vault and exposes only account metadata', () => {
    const vault = createMemorySecretVault();
    const service = createAccountService({ vault });

    const account = service.addAccount({
      name: '剪辑账号',
      accessKeyId: 'ak-local',
      secretAccessKey: 'sk-local',
      endpoint: 'https://visual.volcengineapi.com',
      region: 'cn-north-1',
      service: 'cv',
      concurrencyLimit: 1
    });

    expect(account).toMatchObject({
      name: '剪辑账号',
      accessKeyId: 'ak-local',
      secretAccessKeyRef: expect.stringMatching(/^vault:/),
      concurrencyLimit: 1
    });
    expect(JSON.stringify(service.listAccounts())).not.toContain('sk-local');
    expect(service.getCredentials(account.id)).toMatchObject({
      accountId: account.id,
      accessKeyId: 'ak-local',
      secretAccessKey: 'sk-local'
    });
  });

  it('does not share secrets between different local vaults', () => {
    const firstVault = createMemorySecretVault();
    const secondVault = createMemorySecretVault();
    const firstUser = createAccountService({ vault: firstVault });
    const secondUser = createAccountService({ vault: secondVault });

    const firstAccount = firstUser.addAccount({
      name: '用户一',
      accessKeyId: 'ak-one',
      secretAccessKey: 'sk-one'
    });
    secondUser.addAccount({
      name: '用户二',
      accessKeyId: 'ak-two',
      secretAccessKey: 'sk-two'
    });

    expect(firstVault.readSecret(firstAccount.secretAccessKeyRef)).toBe('sk-one');
    expect(() => secondVault.readSecret(firstAccount.secretAccessKeyRef)).toThrow('密钥不存在');
  });
});
