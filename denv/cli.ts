#!/usr/bin/env -S deno run -A

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

import { cac } from "https://esm.sh/cac@6.7.14";
import { getEnvs, openKv } from "./index.ts";
import { ensureEnv, join, runCommand } from "../common/deps.ts";

interface GlobalOptions {
  path: string;
}

function showHelpAndThrow() {
  cli.outputHelp();
  Deno.exit(1);
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
  .option("--export", "Print enviroment variables to stdout")
  .action(
    async (
      options: GlobalOptions & {
        env: string | string[];
        export: boolean;
        "--": string[];
      },
    ) => {
      let envKeys: string[];
      if (options.env) {
        envKeys = typeof options.env === "string" ? [options.env] : options.env;
      } else {
        envKeys = (Deno.env.get("DENV_KEYS") || "").split(",").filter(Boolean);
      }
      const env = await getEnvs(envKeys, {
        path: options.path,
      });
      const [command, ...args] = options["--"];
      if (command) {
        await runCommand(command, {
          args,
          env: {
            ...Deno.env.toObject(),
            ...env,
          },
        });
      } else if (options.export) {
        console.log(
          Object.entries(env).map(([k, v]) => `${k}=${v}`).join("\n"),
        );
      }
    },
  );

cli.command("cat <key>", "Show the value of a key")
  .action(async (key: string, options: GlobalOptions) => {
    const kv = await openKv(options.path);
    const value = kv.get(key) || "";
    console.log(value);
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

cli.command("rename <key> <name>", "Rename key to a new name")
  .action(async (key: string, value: string, options: GlobalOptions) => {
    const kv = await openKv(options.path);
    kv.rename(key, value);
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
