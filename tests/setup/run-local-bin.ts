import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const cliExports = {
  prisma: "prisma/build/index.js",
  tsx: "tsx/cli",
} as const;

/** Запускает локальный JS CLI через текущий Node.js без платформенных npm-shim. */
export function runLocalBin(
  rootDir: string,
  bin: keyof typeof cliExports,
  args: string[],
  env: NodeJS.ProcessEnv,
): void {
  const require = createRequire(path.join(rootDir, "package.json"));

  execFileSync(process.execPath, [require.resolve(cliExports[bin]), ...args], {
    cwd: rootDir,
    env,
    stdio: "inherit",
  });
}
