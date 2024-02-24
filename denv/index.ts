import { KvDatabase } from 'bun-lib/src/storage/kv';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import yaml from 'yaml';

const defaultPath = 'denv.db';

export interface DenvOptions {
  path?: string;
  kv?: KvDatabase;
}

export async function openKv(path: string) {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const kv = new KvDatabase(path);
  return kv;
}

export function parseEnv(kv: KvDatabase, key: string) {
  const value = kv.get(key);
  if (value == null) {
    throw new Error(`Data not found: ${key}`);
  }
  const result: { local: Record<string, string>; env: Record<string, string> } =
    {
      local: {},
      env: {},
    };
  const parsed = value && yaml.parse(value);
  if (Array.isArray(parsed.extends)) {
    parsed.extends.forEach((dep: string) => {
      const { local, env } = parseEnv(kv, dep);
      result.local = {
        ...env,
        ...result.local,
        ...local,
      };
      result.env = {
        ...result.env,
        ...env,
      };
    });
  }
  result.local = {
    ...result.local,
    ...parsed.local,
  };
  if (parsed.env) {
    Object.entries(parsed.env).forEach(([key, value]) => {
      result.env[key] = `${value}`.replace(
        /\$(?:(\w+)|\{(\w+)\})/g,
        (_, g1, g2) => result.local[g1 || g2] || '',
      );
    });
  }
  return result;
}

export function parseEnvs(kv: KvDatabase, keys: string[]) {
  let env: Record<string, string> = {};
  for (const key of keys) {
    const result = parseEnv(kv, key);
    env = {
      ...env,
      ...result.env,
    };
  }
  return env;
}

export async function getEnvs(keys: string[], options?: DenvOptions) {
  const kv = options?.kv ?? (await openKv(options?.path ?? defaultPath));
  return parseEnvs(kv, keys);
}
