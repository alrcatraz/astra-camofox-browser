import fs from 'node:fs/promises';
import { createClient } from '../helpers/client.js';
import { getSharedEnv } from './sharedEnv.js';

describe('Upload', () => {
  let serverUrl;
  let testSiteUrl;
  let uploadFixture;
  let outsideUploadFixture;

  beforeAll(() => {
    const env = getSharedEnv();
    serverUrl = env.serverUrl;
    testSiteUrl = env.testSiteUrl;
    uploadFixture = env.uploadFixture;
    outsideUploadFixture = env.outsideUploadFixture;
  });

  test('POST /tabs/:tabId/upload attaches an in-root file to an existing input', async () => {
    const client = createClient(serverUrl);

    try {
      const { tabId } = await client.createTab(`${testSiteUrl}/upload`);
      const result = await client.upload(tabId, { path: uploadFixture });

      expect(result).toMatchObject({
        ok: true,
        via: 'direct_input',
        attached: [await fs.realpath(uploadFixture)],
      });

      const selected = await client.evaluate(tabId, "document.getElementById('selected').textContent");
      expect(selected).toMatchObject({ ok: true, result: 'upload.txt' });
    } finally {
      await client.cleanup();
    }
  });

  test('POST /tabs/:tabId/upload rejects a path outside the upload root', async () => {
    const client = createClient(serverUrl);

    try {
      const { tabId } = await client.createTab(`${testSiteUrl}/upload`);

      await expect(client.upload(tabId, { path: outsideUploadFixture }))
        .rejects.toMatchObject({ status: 400, data: { code: 'upload_path_outside_root' } });
    } finally {
      await client.cleanup();
    }
  });
});
