import {afterEach,describe,it,expect,vi} from "vitest";
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir,symlink,rename} from "node:fs/promises";
import path from "node:path";
import {tmpdir} from "node:os";
import { executeProjectCommand as command } from "../../src/project/commands";
import * as services from "../../src/project/services";
const roots:string[]=[];
async function put(root:string,file:string,text:string){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),text);}
async function host(kind="next-app",react="19.1.0"){
 const root=await mkdtemp(path.join(tmpdir(),"seene-portable-"));roots.push(root);
 await put(root,"package.json",JSON.stringify({dependencies:{react,"react-dom":react,"@thatg33k/seene":"0.1.0",...(kind.startsWith("next")?{next:"16.3.5"}:{})},scripts:{dev:"custom-server --anything"}}));
 for(const name of ["react","react-dom"])await put(root,"node_modules/"+name+"/package.json",JSON.stringify({name,version:react}));
 await put(root,"node_modules/@thatg33k/seene/package.json",JSON.stringify({name:"@thatg33k/seene",exports:{"./preview":{import:"./preview.js"},"./next":{import:"./next.js"}}}));
 await put(root,"node_modules/@thatg33k/seene/preview.js","export {}");
 await put(root,"node_modules/@thatg33k/seene/next.js","export {}");
 if(kind==="next-app")await put(root,"app/layout.tsx",'export default function Layout({children}) { return <html><body>{children}</body></html> }');
 if(kind==="next-src")await put(root,"src/app/layout.jsx",'export default function Layout({children}) { return <html><body>{children}</body></html> }');
 if(kind==="next-pages")await put(root,"pages/_app.tsx",'export default function App({Component,pageProps}) { return <Component {...pageProps}/> }');
 return root;
}
async function run(root:string,operation="init-project",input:unknown={}){return command(operation,input,{root});}
function success(value:Awaited<ReturnType<typeof run>>){expect(value,JSON.stringify(value)).toHaveProperty("success",true);if(!value.success)throw Error(JSON.stringify(value));return value.data;}
async function scene(root:string,id="one"){
 await put(root,"src/seene/scenes/"+id+".scene.json",JSON.stringify({version:1,id,title:id,definition:{scene:{nodes:[{id:"ui"}]}}}));
 await put(root,"src/seene/scenes/"+id+".jsx",'export default function Scene(){return null}');
}
afterEach(async()=>{vi.restoreAllMocks();await Promise.all(roots.splice(0).map(root=>rm(root,{recursive:true,force:true})));});
describe("portable host connections",()=>{
 it.each(["next-app","next-src","next-pages","custom"])("initializes %s without changing host files, then validates and retries",async kind=>{
  const root=await host(kind);const pkg=await readFile(path.join(root,"package.json"),"utf8");
  const first=success(await run(root));expect(first.integration?.kind).toBe(kind==="custom"?"react":kind==="next-pages"?"next-pages":"next-app");
  expect(success(await run(root)).changed).toBe(false);
  expect(success(await run(root,"validate-project")).project).toEqual(first.project);
  expect(await readFile(path.join(root,"package.json"),"utf8")).toBe(pkg);
  expect((await readdir(path.join(root,".seene"))).sort()).toEqual(["integration.json","project.json"]);
  const wrapper=await readFile(path.join(root,"src/seene/ProjectPreview.jsx"),"utf8");
  expect(wrapper).not.toMatch(/import\.meta|process\.|next\//);
  expect(wrapper).toContain('from "@thatg33k/seene/preview"');
  if(kind==="next-app") {
   expect(await readFile(path.join(root,"app/api/seene/create-scene/route.js"),"utf8")).toContain('from "@thatg33k/seene/next"');
   expect(await readFile(path.join(root,"src/seene/Studio.jsx"),"utf8")).toContain('createSceneEndpoint="/api/seene/create-scene"');
  }
  if(kind==="next-pages") {
   expect(await readFile(path.join(root,"pages/api/seene/create-scene.js"),"utf8")).toContain("createPagesHandler");
   expect(await readFile(path.join(root,"src/seene/Studio.jsx"),"utf8")).toContain('createSceneEndpoint="/api/seene/create-scene"');
  }
 });
 it.each(["18.2.0","18.3.1","19.0.0","19.1.0","19.2.0"])("uses supported installed React %s without installing Vite",async react=>{
  const root=await host("custom",react);success(await run(root));expect(await readdir(root)).not.toContain("vite.config.ts");
 });
 it("rejects an incompatible React renderer before writes",async()=>{
  const root=await host("custom","17.0.2");expect(await run(root)).toMatchObject({success:false,issues:[{code:"missing-installation"}]});expect(await readdir(root)).not.toContain(".seene");
 });
 it("installs the CLI-matched package version in a clean Next.js project before generating its API route",async()=>{
  const root=await host();
  await rm(path.join(root,"node_modules/@thatg33k/seene"),{recursive:true,force:true});
  const install=vi.spyOn(services,"installPackage").mockImplementation(async(projectRoot,source)=>{
   expect(source).toBe("@thatg33k/seene@0.2.0");
   await put(projectRoot,"node_modules/@thatg33k/seene/package.json",JSON.stringify({name:"@thatg33k/seene",exports:{"./preview":{import:"./preview.js"},"./next":{import:"./next.js"}}}));
   await put(projectRoot,"node_modules/@thatg33k/seene/preview.js","export {}");
   await put(projectRoot,"node_modules/@thatg33k/seene/next.js","export {}");
  });
  const initialized=success(await command("init-project",{},{root,version:"0.2.0"}));
  expect(install).toHaveBeenCalledExactlyOnceWith(root,"@thatg33k/seene@0.2.0","npm");
  expect(initialized.integration?.route).toBe("/seene");
  expect(await readFile(path.join(root,"app/api/seene/create-scene/route.js"),"utf8")).toContain("@thatg33k/seene/next");
 });
 it("detects a Next 15 App Router host from its declared framework before considering Vite",async()=>{
  const root=await host("next-app");
  const packagePath=path.join(root,"package.json");
  const pkg=JSON.parse(await readFile(packagePath,"utf8"));
  pkg.dependencies.next="15.2.8";
  pkg.dependencies.vite="7.3.6";
  pkg.scripts.dev="next dev";
  await writeFile(packagePath,JSON.stringify(pkg));
  await put(root,"app/page.tsx","export default function Home(){return <main>Host homepage stays unchanged</main>}\n");

  const initialized=success(await run(root));
  expect(initialized.integration).toMatchObject({kind:"next-app",route:"/seene"});
  expect(await readFile(path.join(root,"app/page.tsx"),"utf8")).toContain("Host homepage stays unchanged");
  expect(await readFile(path.join(root,"app/seene/page.jsx"),"utf8")).toContain("SeeneStudio");
  expect(await readFile(path.join(root,"src/seene/Studio.jsx"),"utf8")).toContain("active");

  const fetch=vi.spyOn(services,"fetchText").mockResolvedValue(`<meta name="seene-project" content="${initialized.project!.projectId}">`);
  const opened=success(await run(root,"open-preview",{url:"http://localhost:3000",launch:false}));
  expect(opened.url).toBe("http://localhost:3000/seene?seene-preview=1");
  expect(fetch).toHaveBeenCalledExactlyOnceWith("http://localhost:3000/seene?seene-preview=1",30_000);
 });
 it("connects a Next App Router root implemented by a route-group layout",async()=>{
  const root=await host("custom");
  const packagePath=path.join(root,"package.json");
  const pkg=JSON.parse(await readFile(packagePath,"utf8"));
  pkg.dependencies.next="15.2.8";
  pkg.scripts.dev="next dev";
  await writeFile(packagePath,JSON.stringify(pkg));
  const page="export default function Home(){return <main>Route-group homepage</main>}\n";
  await put(root,"src/app/(app)/layout.tsx","export default function Layout({children}) { return <html><body>{children}</body></html> }\n");
  await put(root,"src/app/(app)/page.tsx",page);

  const initialized=success(await run(root));
  expect(initialized.project?.entry).toBe("src/app/(app)/seene/page.jsx");
  expect(initialized.integration).toMatchObject({kind:"next-app",route:"/seene"});
  expect(await readFile(path.join(root,"src/app/(app)/page.tsx"),"utf8")).toBe(page);
  expect(await readFile(path.join(root,"src/app/(app)/seene/page.jsx"),"utf8")).toContain("SeeneStudio");
  expect(await readFile(path.join(root,"src/app/(app)/api/seene/create-scene/route.js"),"utf8")).toContain("@thatg33k/seene/next");
  success(await run(root,"validate-project"));
 });
 it("gives an actionable unavailable-server error for the generated Next route",async()=>{
  const root=await host("next-app");
  const initialized=success(await run(root));
  vi.spyOn(services,"fetchText").mockRejectedValue(new Error("ECONNREFUSED"));
  const result=await run(root,"open-preview",{url:"http://localhost:3000",launch:false});
  expect(result).toMatchObject({success:false,issues:[{code:"missing-dev-server",message:expect.stringContaining("Start this project's existing Next.js dev script")} ]});
  expect(JSON.stringify(result)).toContain("/seene?seene-preview=1");
  expect(initialized.project?.adapter).toBe("next-app");
 });
 it("does not route a next dev script through Vite when next is missing from dependencies",async()=>{
  const root=await host("custom");
  const packagePath=path.join(root,"package.json");
  const pkg=JSON.parse(await readFile(packagePath,"utf8"));
  pkg.dependencies.vite="7.3.6";
  pkg.scripts.dev="next dev";
  await writeFile(packagePath,JSON.stringify(pkg));
  const result=await run(root);
  expect(result).toMatchObject({success:false,issues:[{code:"unsupported-project",message:expect.stringContaining("Next.js dev script was detected")} ]});
  expect(JSON.stringify(result)).not.toContain("Vite entry setup");
  expect(await readdir(root)).not.toContain(".seene");
 });
 it("documents and reports the required manual mount for portable React hosts",async()=>{
  const root=await host("custom");
  success(await run(root));
  const handoff=await readFile(path.join(root,"SEENE.md"),"utf8");
  expect(handoff).toContain("did not edit your renderer entry");
  expect(handoff).toContain("enabled={developmentFlag}");
  const result=await run(root,"open-preview",{url:"http://localhost:3000",launch:false});
  expect(result).toMatchObject({success:false,issues:[{code:"manual-preview",message:expect.stringContaining("does not mount it in a custom React renderer")} ]});
  expect(JSON.stringify(result)).toContain("process.env.NODE_ENV === 'development'");
 });
 it("safely refreshes an unchanged generated handoff from an earlier connection",async()=>{
  const root=await host("next-app");
  success(await run(root));
  const manifestPath=path.join(root,".seene/integration.json");
  const manifest=JSON.parse(await readFile(manifestPath,"utf8"));
  const oldHandoff="# Seene by THATG33K\n\nGenerated by Seene init. Earlier generated guide.\n";
  manifest.files["SEENE.md"]=oldHandoff;
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+"\n");
  await put(root,"SEENE.md",oldHandoff);

  const upgraded=success(await run(root));
  expect(upgraded.changed).toBe(true);
  expect(await readFile(path.join(root,"SEENE.md"),"utf8")).toContain("development-only Studio route at");
  expect(await readFile(path.join(root,"app/api/seene/create-scene/route.js"),"utf8")).toContain("@thatg33k/seene/next");
  expect(success(await run(root,"validate-project")).project).toEqual(upgraded.project);
 });
 it("preserves hand-edited generated connection files (Studio.jsx, ProjectPreview.jsx, SEENE.md) during init and sync",async()=>{
  const root=await host("next-app");
  success(await run(root));
  await put(root, "src/seene/Studio.jsx", '"use client";\nimport React from "react";\nexport default function SeeneStudio({children}){return <div data-custom="studio">{children}</div>;}\n');
  await put(root, "SEENE.md", "# Custom User Hand-edited Guide\n");
  const synced = success(await run(root, "sync-project"));
  expect(synced.changed).toBe(false);
  expect(await readFile(path.join(root, "src/seene/Studio.jsx"), "utf8")).toContain("data-custom=\"studio\"");
  expect(await readFile(path.join(root, "SEENE.md"), "utf8")).toContain("Custom User Hand-edited Guide");
  success(await run(root, "validate-project"));
 });
 it("adds the new local scene API to an existing managed Next.js connection without replacing host files",async()=>{
  const root=await host("next-app");success(await run(root));
  const manifestPath=path.join(root,".seene/integration.json");
  const manifest=JSON.parse(await readFile(manifestPath,"utf8"));
  delete manifest.files["app/api/seene/create-scene/route.js"];
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+"\n");
  await rm(path.join(root,"app/api/seene/create-scene/route.js"));
  const upgraded=success(await run(root));
  expect(upgraded.changed).toBe(true);
  expect(await readFile(path.join(root,"app/api/seene/create-scene/route.js"),"utf8")).toContain("@thatg33k/seene/next");
  success(await run(root,"validate-project"));
 });
 it("can explicitly use the generic connection in any Next host",async()=>{
  const root=await host();const result=success(await run(root,"init-project",{adapter:"react"}));expect(result.integration?.kind).toBe("react");expect(await readdir(path.join(root,"app"))).toEqual(["layout.tsx"]);
 });
 it("preserves route collisions and symlinks",async()=>{
  const root=await host();await put(root,"app/seene/page.tsx","owned");expect(await run(root)).toMatchObject({success:false,issues:[{code:"conflict"}]});expect(await readdir(root)).not.toContain(".seene");
  await rm(path.join(root,"app/seene/page.tsx"));await symlink(path.join(root,"app/layout.tsx"),path.join(root,"app/seene/page.jsx"));
  expect(await run(root)).toMatchObject({success:false,issues:[{code:"denied-path"}]});
 });
 it("refuses unrelated handoff documents on init but preserves edited managed files during validate",async()=>{
  const root=await host();await put(root,"SEENE.md","mine");expect(await run(root)).toMatchObject({success:false,issues:[{code:"conflict"}]});
  await rm(path.join(root,"SEENE.md"));success(await run(root));await put(root,"src/seene/ProjectPreview.jsx","edited");
  expect((await run(root,"validate-project")).success).toBe(true);
 });
  it("uses the canonical catalog, supports JSX and refuses ambiguous bindings",async()=>{
   const root=await host();success(await run(root));await scene(root);success(await run(root,"sync-project"));
   expect(await readFile(path.join(root,"src/seene/catalog.js"),"utf8")).toContain('./scenes/one');
   expect(success(await run(root,"sync-project")).changed).toBe(false);success(await run(root));
   await put(root,"src/seene/scenes/one.tsx","export default function Scene(){return null}");
   expect(await run(root,"sync-project")).toMatchObject({success:false,issues:[{code:"invalid-scenes"}]});
  });
  it("rejects orphaned scene recipes missing a .tsx or .jsx component",async()=>{
   const root=await host();success(await run(root));
   await put(root,"src/seene/scenes/orphan.scene.json",JSON.stringify({version:1,id:"orphan",title:"Orphan",definition:{scene:{nodes:[{id:"ui"}]}}}));
   const orphaned=await run(root,"sync-project");
   expect(orphaned).toMatchObject({success:false,issues:[{code:"invalid-scenes",message:/needs matching component/}]});
   await put(root,"src/seene/scenes/orphan.tsx","export default function Scene(){return null}");
   const resolved=success(await run(root,"sync-project"));
   expect(resolved).toHaveProperty("changed",true);
  });
 it("recovers interrupted additive init without replacing existing files",async()=>{
  const root=await host();const actual=services.atomicWrite;let failed=false;
  vi.spyOn(services,"atomicWrite").mockImplementation(async(...args)=>{if(args[1]==="src/seene/Studio.jsx"&&!failed){failed=true;throw Error("interrupted");}return actual(...args)});
  expect((await run(root)).success).toBe(false);success(await run(root));success(await run(root,"validate-project"));
 });
 it("recovers an interrupted catalog ownership update",async()=>{
  const root=await host();success(await run(root));await scene(root);
  const actual=services.atomicWrite;let failed=false;
  vi.spyOn(services,"atomicWrite").mockImplementation(async(...args)=>{if(args[1]===".seene/integration.json"&&!failed){failed=true;throw Error("interrupted");}return actual(...args)});
  expect((await run(root,"sync-project")).success).toBe(false);success(await run(root,"sync-project"));success(await run(root,"validate-project"));
 });
});

it("resolves linked renderer dependencies without treating them as mutation targets",async()=>{
 const root=await host("custom");await rename(path.join(root,"node_modules/react"),path.join(root,"react-store"));await symlink(path.join(root,"react-store"),path.join(root,"node_modules/react"));
 success(await run(root));expect(JSON.parse(await readFile(path.join(root,"react-store/package.json"),"utf8")).version).toBe("19.1.0");
});

it("does not mistake an Electron/custom renderer's Vite dependency for a Vite app",async()=>{
 const root=await host("custom");const file=path.join(root,"package.json");const pkg=JSON.parse(await readFile(file,"utf8"));pkg.dependencies.vite="7.3.6";pkg.dependencies.electron="42.0.0";pkg.scripts.dev="electron-vite dev";await writeFile(file,JSON.stringify(pkg));
 expect(success(await run(root)).integration?.kind).toBe("react");expect(await readFile(file,"utf8")).toBe(JSON.stringify(pkg));
});
