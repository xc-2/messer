#!/usr/bin/env -S bun run

/*
 * Usage:
 *
 * ```bash
 * # Run commands
 * $ denv run -e key1 -e key2 -- command arg1 arg2
 * $ DENV_KEYS=key1,key2 denv run -- command arg1 arg2
 *
 * # Show env
 * $ denv run -e key1 -e key2 --export
 *
 * # Import env in a script
 * $ . <(denv run -e key1 -e key2 --export)
 * ```
 */

import { ensureEnv } from 'bun-lib/src/env';
import { runCommand } from 'bun-lib/src/cli';
import { cac } from 'cac';
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { temporaryFileTask } from 'tempy';
import { getEnvs, openKv } from './index.ts';

interface GlobalOptions {
  path: string;
}

const cli = cac('denv');
cli.option('--path <path>', 'Set path of database', {
  default: join(ensureEnv('HOME'), '.config/denv.db'),
});
cli.help();
cli.command('').action(showHelpAndThrow);

// Unknown command
cli.on('command:*', showHelpAndThrow);

cli
  .command('run', 'Run command with env')
  .option('-e, --env <key>', 'Keys to load enviroment')
  .option('--export', 'Print enviroment variables to stdout')
  .action(
    async (
      options: GlobalOptions & {
        env: string | string[];
        export: boolean;
        '--': string[];
      },
    ) => {
      let envKeys: string[];
      if (options.env) {
        envKeys = typeof options.env === 'string' ? [options.env] : options.env;
      } else {
        envKeys = (process.env.DENV_KEYS || '').split(',').filter(Boolean);
      }
      const env = await getEnvs(envKeys, {
        path: options.path,
      });
      const [command, ...args] = options['--'];
      if (command) {
        await runCommand([command, ...args], {
          env: {
            ...process.env,
            ...env,
          },
        });
      } else if (options.export) {
        console.log(
          Object.entries(env)
            .map(([k, v]) => `${k}=${v}`)
            .join('\n'),
        );
      }
    },
  );

cli
  .command('cat <key>', 'Show the value of a key')
  .action(async (key: string, options: GlobalOptions) => {
    const kv = await openKv(options.path);
    const value = kv.get(key) || '';
    console.log(value);
  });

cli
  .command('del <key>', 'Delete a key')
  .action(async (key: string, options: GlobalOptions) => {
    const kv = await openKv(options.path);
    kv.del(key);
  });

cli.command('keys', 'List all keys').action(async (options: GlobalOptions) => {
  const kv = await openKv(options.path);
  console.log(kv.keys().join('\n'));
});

cli
  .command('rename <key> <name>', 'Rename key to a new name')
  .action(async (key: string, value: string, options: GlobalOptions) => {
    const kv = await openKv(options.path);
    kv.rename(key, value);
  });

cli
  .command('edit <key>', 'Edit the value of a key with $EDITOR')
  .action(async (key: string, options: GlobalOptions) => {
    const kv = await openKv(options.path);
    const value = kv.get(key) || '';
    await temporaryFileTask(
      async (temp) => {
        await Bun.write(temp, value);
        await runCommand([ensureEnv('EDITOR'), temp]);
        const newValue = await Bun.file(temp).text();
        kv.set(key, newValue);
      },
      {
        name: `${key}.yml`,
      },
    );
  });

cli
  .command('import <source>', 'Import data from a directory')
  .action(async (source: string, options: GlobalOptions) => {
    const kv = await openKv(options.path);
    for (const entry of await readdir(source)) {
      const key = entry.replace(/\.yml$/, '');
      const value = await Bun.file(join(source, entry)).text();
      kv.set(key, value);
      console.log(`Imported entry: ${key}`);
    }
  });

cli
  .command('export', 'Export all data to a directory')
  .option('-o, --outdir <outdir>', 'Output directory', {
    default: 'env-data',
  })
  .action(async (options: GlobalOptions & { outdir: string }) => {
    await mkdir(options.outdir, { recursive: true });
    const kv = await openKv(options.path);
    for (const { key, value } of kv.all()) {
      await Bun.write(join(options.outdir, `${key}.yml`), value);
    }
    console.log(`Data exported to ${options.outdir}`);
  });

cli.parse();

function showHelpAndThrow() {
  cli.outputHelp();
  process.exit(1);
}
