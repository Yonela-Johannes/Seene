import { RESOURCES } from "../core/resources";
import { SEENE_BRAND } from "../core/branding";
import { formatOnboarding, terminalWelcome, type TerminalOptions } from "./terminal";
import { executeSceneSnapshot, executeVideoExport } from "../export/commands";
import { executeProjectCommand } from "../project/commands";
import { executeRecipeCommand, type RecipeCommandResult } from "../project/recipes";
import type { ProjectResult } from "../core/project";

type Environment = { root: string; port?: string; terminal?: TerminalOptions; progress?: (text: string) => void };
type Execute = typeof executeProjectCommand;
export type CliResult = { code: number; stdout: string; stderr: string };
const usage = `${SEENE_BRAND.title} — cinematic 3D motion from your real application UI.
${SEENE_BRAND.url}
Run seene guide to learn spatial composition, camera, focus and motion.

seene --version
seene guide [--json]
seene init [--adapter auto|react] [--project DIR] [--package TARBALL] [--url ORIGIN] [--no-open]
seene open [--scene ID] [--project DIR] [--url ORIGIN] [--no-open]
seene sync [--project DIR]
seene scenes [--project DIR] [--json]
seene snapshot --scene ID --url ORIGIN [--time MS] [--project DIR] [--json]
seene load [--scene ID] [--project DIR] [--json]
seene validate [--project DIR]
seene export --url URL --output FILE [--fps 30|60|120] [--width N --height N] [--quality N] [--project DIR] [--json]

Setup in a React DOM app (React 18.2+ or 19): npm install @thatg33k/seene, then npx @thatg33k/seene init
init connects the app and writes SEENE.md; run it from the project root after npm install.
Next.js App/Pages Router and standard Vite React roots get automatic connections; other React DOM hosts get a generated wrapper that must be mounted manually.
Afterwards run it as "seene", "npx seene" or "pnpm exec seene" depending on your package manager.
--package accepts a local .tgz to install a local build instead; --adapter react forces the portable connection.
init preserves the existing root/providers and creates SEENE.md for documentation.
Add --url to initialize and open in one command.
open reuses your running dev server (APP_PORT / PORT / 5173); it never starts another server.
--no-open verifies and prints the preview URL without launching a browser.
--json prints the canonical command result for scripts.
`;
function output(result: ProjectResult, json: boolean, onboarding?: { terminal?: TerminalOptions; streamed: boolean }): CliResult {
  if (!result.success) return { code: 1, stdout: "", stderr: json ? JSON.stringify(result) + "\n" : result.issues.map(i => `${i.code}${i.path ? ` (${i.path})` : ""}: ${i.message}`).join("\n") + "\n" };
  if (onboarding && !json) return {code:0, stdout:formatOnboarding(result, onboarding.terminal, !onboarding.streamed), stderr:""};
  const message = result.data.url ?? (result.data.project
    ? `Project ${result.data.integration?.kind === "react" ? "connection generated" : "ready"}: ${result.data.project.entry}${result.data.changed ? " (initialized)" : ""}.\nUse your running dev server, or start it with the dev script declared by this project. Then run pnpm exec seene open --url <origin printed by your app>.`
    : "Project command completed.");
  const next = "\nScene authoring: use the Seene studio inspector to compose animations.";
  return { code: 0, stdout: (json ? JSON.stringify(result) : `${SEENE_BRAND.title}\n${SEENE_BRAND.url}\n${message}${result.data.integration ? "\n" + result.data.integration.instructions : ""}${next}`) + "\n", stderr: "" };
}
function recipeOutput(result: RecipeCommandResult, json: boolean): CliResult {
  const issues = result.success ? result.data.issues : result.issues;
  const diagnostics = issues.map(issue => `${issue.path}: ${issue.message}`).join("\n");
  if (!result.success) return { code: 1, stdout: "", stderr: (json ? JSON.stringify(result) : diagnostics) + "\n" };
  const text = result.data.url ?? (result.data.selected ? JSON.stringify(result.data.selected, null, 2)
    : result.data.scenes.length ? result.data.scenes.map(scene => `${scene.id}\t${scene.title}`).join("\n")
      : "No local scenes found. Add a recipe and matching component in src/seene/scenes.");
  return { code: 0, stdout: (json ? JSON.stringify(result) : text) + "\n", stderr: !json && diagnostics ? diagnostics + "\n" : "" };
}
export async function runCli(argv: string[], environment: Environment, execute: Execute = executeProjectCommand, exporter: typeof executeVideoExport = executeVideoExport, recipes: typeof executeRecipeCommand = executeRecipeCommand, snapshotter:typeof executeSceneSnapshot=executeSceneSnapshot): Promise<CliResult> {
  if (argv.length === 1 && ["--version", "-v"].includes(argv[0]))
    return {code:0, stdout:(environment.terminal?.version ?? "development") + "\n", stderr:""};
  if (argv.length === 0 || (argv.length === 1 && ["--help", "-h", "help"].includes(argv[0])))
    return { code: 0, stdout: environment.terminal?.interactive ? terminalWelcome(environment.terminal) + usage.split("\n").slice(2).join("\n") : usage, stderr: "" };
  const [command, ...args] = argv;
  if(command === "guide") {
    if(args.length>1 || (args.length===1 && args[0]!=="--json"))return {code:2,stdout:"",stderr:"Usage: seene guide [--json]\n"};
    const guide=RESOURCES["authoring-guide"]();
    const text=[guide.purpose,guide.creativeFreedom,...guide.concepts.map(c=>`## ${c.title}\n${c.meaning}\nHow it works: ${c.mechanism}\nCreative choices: ${c.choices}\nWatch for: ${c.pitfalls}\nVerify: ${c.verify}`),"## Workflow\n"+guide.workflow.map((s,i)=>`${i+1}. ${s}`).join("\n"),"## Installed API and defaults\n"+JSON.stringify(guide.capabilities,null,2)].join("\n\n");
    return {code:0,stdout:(args[0]==="--json"?JSON.stringify(guide):`${SEENE_BRAND.title}\n${SEENE_BRAND.url}\n\n${text}`)+"\n",stderr:""};
  }
  const aliases = { init: "init-project", sync: "sync-project", open: "open-preview", load: "load-project", validate: "validate-project" } as const;
  const fail = (message: string): CliResult => ({ code: 2, stdout: "", stderr: message + "\n\n" + usage });
  if (command !== "snapshot" && command !== "export" && command !== "scenes" && !Object.hasOwn(aliases, command)) return fail(`Unknown command: ${command}`);
  const flags = new Map<string, string | true>();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!(command === "snapshot" ? ["--project","--url","--scene","--time","--json"] : command === "export" ? ["--project", "--url", "--output", "--fps", "--width", "--height", "--quality", "--json"] : ["--project", "--package", "--url", "--no-open", "--json", "--scene", "--adapter", "--host"]).includes(flag)) return fail(`Unknown option: ${flag}`);
    if (flags.has(flag)) return fail(`Duplicate option: ${flag}`);
    if (["--no-open", "--json"].includes(flag)) flags.set(flag, true);
    else {
      const value = args[++i];
      if (!value || value.startsWith("--")) return fail(`Missing value for ${flag}`);
      flags.set(flag, value);
    }
  }
  if (flags.has("--adapter") && command !== "init") return fail("--adapter is only valid for init.");
  if (flags.has("--package") && command !== "init") return fail("--package is only valid for init.");
  if (flags.has("--host") && command !== "init") return fail("--host is only valid for init.");
  if (flags.has("--scene") && !["load", "open", "snapshot"].includes(command)) return fail("--scene is only valid for load, open or snapshot.");
  if (["load", "validate", "scenes", "sync"].includes(command) && (flags.has("--url") || flags.has("--no-open"))) return fail("Preview options require init or open.");
  if (command === "init" && flags.has("--no-open") && !flags.has("--url")) return fail("init --no-open requires --url. To initialize without opening a browser, run seene init.");
  const context = { root: flags.get("--project") as string ?? environment.root, version: environment.terminal?.version };
  const json = flags.has("--json");
  if(command==="snapshot"){
    if(!flags.has("--scene")||!flags.has("--url"))return fail("snapshot requires --scene and --url.");
    try{
      const result=await snapshotter({sceneId:flags.get("--scene"),url:flags.get("--url"),...(flags.has("--time")?{timeMs:Number(flags.get("--time"))}:{})},context);
      return result.success?{code:0,stdout:(json?JSON.stringify(result):`Snapshot saved for ${result.data.sceneId}.`)+"\n",stderr:""}
       :{code:1,stdout:"",stderr:(json?JSON.stringify(result):result.issues.map(i=>i.message).join("\n"))+"\n"};
    }catch{return {code:1,stdout:"",stderr:"Snapshot failed. Check the scene and retry.\n"}}
  }
  if (command === "scenes" || flags.has("--scene")) {
    const operation = command === "scenes" ? "list-scenes" : command === "open" ? "open-scene" : "load-scene";
    const input = command === "scenes" ? {} : { sceneId: flags.get("--scene"), ...(command === "open" ? {
      url: flags.get("--url") ?? `http://127.0.0.1:${environment.port ?? "5173"}`, launch: !flags.has("--no-open"),
    } : {}) };
    try { return recipeOutput(await recipes(operation, input, context), json); }
    catch { return { code: 1, stdout: "", stderr: "Scene command failed unexpectedly. Check the local recipes and retry.\n" }; }
  }
  if (command === "export") {
    if (!flags.has("--url") || !flags.has("--output")) return fail("export requires --url and --output.");
    const input = { url: flags.get("--url"), output: flags.get("--output"),
      ...Object.fromEntries(["fps", "width", "height"].filter(key => flags.has(`--${key}`)).map(key => [key, Number(flags.get(`--${key}`))])),
      ...(flags.has("--quality") ? { crf: Number(flags.get("--quality")) } : {}) };
    try {
      const result = await exporter(input, context);
      if (!result.success) return { code: 1, stdout: "", stderr: (json ? JSON.stringify(result) : result.issues.map(i => `${i.code}: ${i.message}`).join("\n")) + "\n" };
      return { code: 0, stdout: (json ? JSON.stringify(result) : `Exported ${result.data.output} (${result.data.frames} frames at ${result.data.fps} FPS).`) + "\n", stderr: "" };
    } catch { return { code: 1, stdout: "", stderr: "Video export failed unexpectedly. Check the local scene server and retry.\n" }; }
  }
  const input = command === "init" ? { ...(flags.has("--adapter") ? {adapter:flags.get("--adapter")} : {}), ...(flags.has("--package") ? { packageSource: flags.get("--package") } : {}), ...(flags.has("--host") ? { hostPath: flags.get("--host") as string } : {}) }
    : command === "open" ? { url: flags.get("--url") ?? `http://127.0.0.1:${environment.port ?? "5173"}`, launch: !flags.has("--no-open") } : {};
  const onboarding = command === "init" ? {terminal:environment.terminal, streamed:!json && !!environment.progress} : undefined;
  if (onboarding?.streamed) environment.progress!(terminalWelcome(environment.terminal) + "Preparing your project…\n");
  try {
    const result = await execute(aliases[command as keyof typeof aliases], input, context);
    if (!result.success || command !== "init" || !flags.has("--url")) return output(result, json, onboarding);
    const opened = await execute("open-preview", { url: flags.get("--url"), launch: !flags.has("--no-open") }, context);
    if (opened.success) return output({ success: true, data: { ...result.data, ...opened.data } }, json, onboarding);
    const failure = output(opened, json);
    return json ? failure : { ...failure, stdout: output(result, false, onboarding).stdout };
  } catch {
    return {code:1,stdout:"",stderr:"Project command failed unexpectedly. Your setup may be incomplete; run seene validate, correct the reported issue and retry.\n"};
  }
}
