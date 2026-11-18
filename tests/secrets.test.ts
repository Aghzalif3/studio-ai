import { describe, expect, it, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('encrypted API keys', () => {
  let mod: typeof import('@/lib/server/secrets');
  let dir: string;
  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-secrets-'));
    process.env.STUDIO_DATA_DIR = dir;
    delete process.env.FAL_KEY;
    mod = await import('@/lib/server/secrets');
  });
  it('stores keys encrypted and only exposes a hint', () => {
    mod.setSecret('FAL_KEY', 'sk-test-1234567890abcd');
    const raw = fs.readFileSync(path.join(dir, 'secrets.enc.json'), 'utf8');
    expect(raw).not.toContain('1234567890');
    expect(mod.getSecret('FAL_KEY')).toBe('sk-test-1234567890abcd');
    const st = mod.secretStatus().find((x) => x.name === 'FAL_KEY')!;
    expect(st.set).toBe(true);
    expect(st.hint).toBe('••••abcd');
    expect(JSON.stringify(mod.secretStatus())).not.toContain('1234567890');
    mod.setSecret('FAL_KEY', null);
    expect(mod.getSecret('FAL_KEY')).toBeUndefined();
  });
});
