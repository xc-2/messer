#!/usr/bin/env -S deno run -A

import { cac } from "https://esm.sh/cac@6.7.14";
import yaml from "https://esm.sh/yaml@2.3.3";
import {
  dirname,
  ensureEnv,
  join,
  KvDatabase,
  runCommand,
} from "./common/deps.ts";

interface GlobalOptions {
  path: string;
}

function showHelpAndThrow() {
  cli.outputHelp();
  Deno.exit(1);
}

async function openKv(path: string) {
  const dir = dirname(path);
  await Deno.mkdir(dir, { recursive: true });
  const kv = new KvDatabase(path);
  return kv;
}

function parseEnv(kv: KvDatabase, key: string) {
  const value = kv.get(key);
  const result: { local: Record<string, string>; env: Record<string, string> } =
    {
      local: {},
      env: {},
    };
  try {
    const parsed = value && yaml.parse(value);
    if (Array.isArray(parsed.extends)) {
      parsed.extends.forEach((dep: string) => {
        const { local, env } = parseEnv(kv, dep);
        result.local = {
          ...env,
          ...result.local,
          ...local,
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
          (_, g1, g2) => result.local[g1 || g2] || "",
        );
      });
    }
  } catch {
    // ignore
  }
  return result;
}

function parseEnvs(kv: KvDatabase, keys: string[]) {
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

const cli = cac("denv");
cli.option("--path <path>", "Set path of database", {
  default: join(ensureEnv("HOME"), ".config/denv.db"),
});
cli.help();
cli.command("").action(showHelpAndThrow);

// Unknown command
cli.on("command:*", showHelpAndThrow);

cli.command("run", "Run command with env")
  .option("-e, --env <key>", "Keys to load enviroment")
  .action(
    async (
      options: GlobalOptions & { env: string | string[]; "--": string[] },
    ) => {
      const [command, ...args] = options["--"];
      if (!command) {
        return showHelpAndThrow();
      }
      let envKeys: string[];
      if (options.env) {
        envKeys = typeof options.env === "string" ? [options.env] : options.env;
      } else {
        envKeys = (Deno.env.get("DENV_KEYS") || "").split(",").filter(Boolean);
      }
      const kv = await openKv(options.path);
      const env = {
        ...Deno.env.toObject(),
        ...parseEnvs(kv, envKeys),
      };
      if (command) {
        await runCommand(command, {
          args,
          env,
        });
      }
    },
  );

cli.command("cat <key>", "Show the value of a key")
  .action(async (key: string, options: GlobalOptions) => {
    const kv = await openKv(options.path);
    const value = kv.get(key) || "";
    console.log(value);
    parseEnv(kv, key);
  });

cli.command("del <key>", "Delete a key")
  .action(async (key: string, options: GlobalOptions) => {
    const kv = await openKv(options.path);
    kv.del(key);
  });

cli.command("keys", "List all keys")
  .action(async (options: GlobalOptions) => {
    const kv = await openKv(options.path);
    console.log(kv.keys().join("\n"));
  });

cli.command("edit <key>", "Edit the value of a key with $EDITOR")
  .action(async (key: string, options: GlobalOptions) => {
    const kv = await openKv(options.path);
    const value = kv.get(key) || "";
    const temp = await Deno.makeTempFile({
      prefix: key,
      suffix: ".yml",
    });
    await Deno.writeTextFile(temp, value);
    await runCommand(ensureEnv("EDITOR"), {
      args: [temp],
    });
    const newValue = await Deno.readTextFile(temp);
    kv.set(key, newValue);
    await Deno.remove(temp);
  });

cli.command("import <source>", "Import data from a directory")
  .action(async (source: string, options: GlobalOptions) => {
    const kv = await openKv(options.path);
    for await (const entry of Deno.readDir(source)) {
      const key = entry.name.replace(/\.yml$/, "");
      const value = await Deno.readTextFile(join(source, entry.name));
      kv.set(key, value);
      console.log(`Imported entry: ${key}`);
    }
  });

cli.command("export", "Export all data to a directory")
  .option("-o, --outdir <outdir>", "Output directory", {
    default: "env-data",
  })
  .action(async (options: GlobalOptions & { outdir: string }) => {
    await Deno.mkdir(options.outdir, { recursive: true });
    const kv = await openKv(options.path);
    for (const [key, value] of kv.all()) {
      await Deno.writeTextFile(join(options.outdir, `${key}.yml`), value);
    }
    console.log(`Data exported to ${options.outdir}`);
  });

cli.parse();
