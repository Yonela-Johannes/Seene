import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {chromium,expect} from '@playwright/test';
const root=fileURLToPath(new URL('../',import.meta.url));
const scratch=await mkdtemp(path.join(tmpdir(),'seene-frameworks-'));
const children=[];let browser;
const kind=process.argv[2]??'app';
const host=path.join(scratch,'host');
async function put(file,text){await mkdir(path.dirname(path.join(host,file)),{recursive:true});await writeFile(path.join(host,file),text)}
function run(exe,args,cwd=host){return new Promise((resolve,reject)=>{const child=spawn(exe,args,{cwd,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);const timer=setTimeout(()=>child.kill(),110000);child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);code===0?resolve(output):reject(Error(output))})})}
async function freePort(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port}
async function server(args){const port=await freePort();const child=spawn(process.execPath,['node_modules/next/dist/bin/next',...args,'-H','127.0.0.1','-p',String(port)],{cwd:host,env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});children.push(child);let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);const url='http://127.0.0.1:'+port;for(let i=0;i<150;i++){try{const r=await fetch(url,{signal:AbortSignal.timeout(1000)});if(r.ok)return {url,child}}catch{}if(child.exitCode!==null)throw Error(log);await new Promise(r=>setTimeout(r,100))}throw Error(log)}
try{
 await mkdir(host,{recursive:true});
 const published=process.env.SEENE_REGISTRY_PACKAGE;
 const packOut=published?undefined:await run('npm',['pack','--ignore-scripts','--json','--pack-destination',scratch],root);
 const packJson=published?undefined:JSON.parse(packOut.slice(Math.min(...[packOut.indexOf('{'),packOut.indexOf('[')].filter(i=>i>=0))));
 const packed=published?undefined:(Array.isArray(packJson)?packJson[0]:Object.values(packJson)[0]);
 const tarball=published?published.replace(/^@thatg33k\/seene@/,''):path.join(scratch,packed.filename);
 const react=kind==='app'?'19.2.0':'18.3.1';
 await put('package.json',JSON.stringify({private:true,type:'module',dependencies:{react,'react-dom':react,'@thatg33k/seene':tarball,...(kind!=='react'?{next:'16.3.5'}:{'@types/react':'^18.3.0','@types/react-dom':'^18.3.0',typescript:'5.9.3'})}}));
 await run('npm',['install','--ignore-scripts','--no-audit','--no-fund',...(published?['--cache',path.join(scratch,'cache'),'--registry','https://registry.npmjs.org/']:[])]);
 if(published){const installed=JSON.parse(await readFile(path.join(host,'node_modules/@thatg33k/seene/package.json'),'utf8'));assert.equal(installed.name+'@'+installed.version,published);}
 const counter='"use client";\nimport React,{createContext,useContext,useState} from "react";\nconst Context=createContext("missing");\nexport function Provider({children}) {return <Context.Provider value="existing provider">{children}</Context.Provider>}\nexport default function Counter(){const value=useContext(Context);const [count,setCount]=useState(0);return <article style={{background:"#fafafa",color:"#111",padding:40,width:700,height:400}}><h1>{value}</h1><button onClick={()=>setCount(c=>c+1)}>Count {count}</button></article>}';
 await put('src/Counter.jsx',counter);
 if(kind==='app'){
    await put('app/layout.jsx','import React from "react"; import {Provider} from "../src/Counter"; export default function Layout({children}){return <html><body><Provider><header data-testid="host-header" style={{position:"fixed",top:0,left:0,right:0,zIndex:999999,background:"red",height:32}}>Host header</header>{children}<footer data-testid="host-footer" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:999999,background:"lime",height:32}}>Host footer</footer></Provider></body></html>}');
  await put('app/page.jsx','import React from "react"; import Counter from "../src/Counter"; export default function Page(){return <Counter/>}');
 }else if(kind==='pages'){
    await put('pages/_app.jsx','import React from "react"; import {Provider} from "../src/Counter"; export default function App({Component,pageProps}){return <Provider><header data-testid="host-header" style={{position:"fixed",top:0,left:0,right:0,zIndex:999999,background:"red",height:32}}>Host header</header><Component {...pageProps}/><footer data-testid="host-footer" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:999999,background:"lime",height:32}}>Host footer</footer></Provider>}');
  await put('pages/index.jsx','export {default} from "../src/Counter";');
 }
 const cli=path.join(host,'node_modules/@thatg33k/seene/dist/cli/seene.js');
 const initialized=JSON.parse(await run(process.execPath,[cli,'init','--json']));
 assert.equal(initialized.success,true);assert.equal(initialized.data.integration.kind,kind==='react'?'react':'next-'+kind);
 assert.equal(JSON.parse(await run(process.execPath,[cli,'init','--json'])).data.changed,false);
 const recipe={version:1,id:'survey',title:'Host survey',definition:{width:1000,height:700,scene:{nodes:[{id:'host'}],camera:{rotateY:20,perspective:1800}},motion:{durationMs:200,tracks:[]}}};
 await put('src/seene/scenes/survey.scene.json',JSON.stringify(recipe));
 await put('src/seene/scenes/survey.jsx','"use client";\nimport React from "react"; import {Surface} from "@thatg33k/seene"; import Counter from "../../Counter"; export default function HostScene(){return <Surface id="host"><Counter/></Surface>}');
 await run(process.execPath,[cli,'sync']);
 await run(process.execPath,[cli,'validate']);
 try{browser=await chromium.launch({channel:'chromium',headless:true})}catch{browser=await chromium.launch({channel:'chrome',headless:true})}
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('console', msg => console.log('PAGE LOG:', msg.text()));
 const errors=[];page.on('pageerror',e=>{ console.log('PAGE ERROR:', e); errors.push(e.message); });
 let url;let dev;
 if(kind==='react'){
  await put('check.tsx','import React from "react"; import {Scene,Surface} from "@thatg33k/seene"; import {ProjectPreview} from "@thatg33k/seene/preview"; export const check=<ProjectPreview projectId="test" enabled active><Scene><Surface id="test">Host</Surface></Scene></ProjectPreview>;');
  await run(process.execPath,['node_modules/typescript/bin/tsc','--noEmit','--strict','--jsx','react-jsx','--module','esnext','--moduleResolution','bundler','--target','es2022','--allowSyntheticDefaultImports','check.tsx']);
  await put('entry.jsx' ,'import React from "react"; import {createRoot} from "react-dom/client"; import {SeeneProjectPreview} from "./src/seene/ProjectPreview"; import Counter,{Provider} from "./src/Counter"; createRoot(document.getElementById("root")).render(<Provider><SeeneProjectPreview enabled active><Counter/></SeeneProjectPreview></Provider>);');
  await run(path.join(root,'node_modules/.bin/esbuild'),['entry.jsx','--bundle','--outfile=bundle.js','--define:process.env.NODE_ENV="development"']);
  const staticServer=createServer(async(req,res)=>{res.setHeader('content-type',req.url==='/bundle.js'?'text/javascript':'text/html');res.end(req.url==='/bundle.js'?await readFile(path.join(host,'bundle.js')):'<div id="root"></div><script src="/bundle.js"></script>')});
  await new Promise(r=>staticServer.listen(0,'127.0.0.1',r));children.push({kill:()=>staticServer.close()});url='http://127.0.0.1:'+staticServer.address().port+'/?seene-preview=1';
 }else{
  dev=await server(kind==='app'?['dev']:['dev','--webpack']);url=dev.url;
  const created=await fetch(new URL('/api/seene/create-scene',url),{method:'POST',headers:{origin:url,'content-type':'application/json'},body:JSON.stringify({id:'created-from-studio',recipe:{...recipe,id:'created-from-studio',title:'Created from Studio'}})});
  assert.equal(created.headers.get('content-type')?.includes('application/json'),true,'scene creation must return JSON');
  assert.equal(created.status,200,await created.clone().text());assert.deepEqual(await created.json(),{success:true,id:'created-from-studio'});
  assert.ok((await readFile(path.join(host,'src/seene/catalog.js'),'utf8')).includes('created-from-studio.scene.json'));
    await page.goto(url);await expect(page.getByTestId('host-header')).toBeVisible();await expect(page.getByTestId('host-footer')).toBeVisible();await expect(page.getByRole('button',{name:'Count 0'})).toBeVisible();
  await page.getByRole('button',{name:'Count 0'}).click();await expect(page.getByRole('button',{name:'Count 1'})).toBeVisible();
  const opened=JSON.parse(await run(process.execPath,[cli,'open','--url',url,'--no-open','--json']));assert.equal(opened.data.url,url+'/seene?seene-preview=1');
  url=opened.data.url;
 }
 await page.goto(url);
 if(kind!=='react') {
  await page.locator('[data-seene-studio-root]').waitFor({state:'attached',timeout:30000});
  const shell=await page.evaluate(()=>{const root=document.querySelector('[data-seene-studio-root]');const top=document.elementFromPoint(4,4);const bottom=document.elementFromPoint(4,innerHeight-4);return {root:root&&{rect:root.getBoundingClientRect().toJSON(),style:root.getAttribute('style')},top:top&&{tag:top.tagName,id:top.id,testid:top.getAttribute('data-testid'),studio:!!top.closest('[data-seene-studio-root]')},bottom:bottom&&{tag:bottom.tagName,id:bottom.id,testid:bottom.getAttribute('data-testid'),studio:!!bottom.closest('[data-seene-studio-root]')},htmlStyle:document.documentElement.getAttribute('style'),bodyStyle:document.body.getAttribute('style'),htmlOverflow:getComputedStyle(document.documentElement).overflow,bodyOverflow:getComputedStyle(document.body).overflow}});
  const isolated=!!shell.top?.studio&&!!shell.bottom?.studio&&shell.htmlOverflow==='hidden'&&shell.bodyOverflow==='hidden';
  assert.equal(isolated,true,`The Next Studio route must cover host chrome and lock host-page scrolling: ${JSON.stringify(shell)}`);
 }
 await expect(page.getByText('Host survey',{exact:true})).toBeVisible({timeout:30000});
 await page.getByText('Host survey',{exact:true}).click();
 await expect(page.getByRole('button',{name:'Count 0'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'existing provider'})).toBeVisible();
 await page.getByRole('button',{name:'Count 0'}).click();
 await expect(page.getByRole('button',{name:'Count 1'})).toBeVisible();
 await page.getByRole('button',{name:'Count 1'}).evaluate(el=>el.dataset.kept='true');
 if(kind!=='react'){
  recipe.title='Revised host survey';
  await put('src/seene/scenes/survey.scene.json',JSON.stringify(recipe));
  await expect(page.getByRole('button',{name:'Count 1'})).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator('[data-kept="true"]')).toHaveText('Count 1');
 }
 await mkdir(path.join(root,'test-results'),{recursive:true});
 await page.screenshot({path:path.join(root,'test-results/portable-'+kind+'.png')});
 assert.deepEqual(errors,[]);
 if(kind==='app'){
  await run(process.execPath,[cli,'snapshot','--scene','survey','--url',dev.url]);
  await run(process.execPath,[cli,'export','--url',url+'&seene-scene=survey','--output','scene.mp4','--fps','30','--width','640','--height','480']);
  const probe=JSON.parse(await run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=nb_frames,r_frame_rate','-of','json','scene.mp4']));
  assert.equal(probe.streams[0].r_frame_rate,'30/1');assert.ok(Number(probe.streams[0].nb_frames)>0);
 }
 if(kind!=='react'){
  const disposable={version:1,id:'delete-through-studio',title:'Delete through Studio',definition:{scene:{version:3,nodes:[{id:'host'}]}}};
  await put('src/seene/scenes/delete-through-studio.scene.json',JSON.stringify(disposable));
  await put('src/seene/scenes/delete-through-studio.jsx','"use client"; import React from "react"; import {Surface} from "@thatg33k/seene"; export default function Disposable(){return <Surface id="host">Disposable scene</Surface>}');
  await run(process.execPath,[cli,'sync']);
  await page.goto(dev.url+'/seene?seene-preview=1');
  const disposableRow=page.locator('[data-scene-id="delete-through-studio"]');
  await expect(disposableRow).toHaveCount(1);
  let deletePayload;
  page.on('request',request=>{if(request.method()==='DELETE'&&request.url().endsWith('/api/seene/create-scene'))deletePayload=JSON.parse(request.postData()||'{}')});
  const apiPattern='**/api/seene/create-scene';
  await page.route(apiPattern,route=>route.request().method()==='DELETE'?route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Simulated delete failure'})}):route.continue());
  await page.getByRole('button',{name:'Delete Delete through Studio'}).click();
  await expect(page.getByRole('dialog',{name:'Delete Scene'})).toBeVisible();
  await page.getByRole('button',{name:'Confirm Delete'}).click();
  await expect(page.getByText('Simulated delete failure',{exact:true})).toBeVisible();
  await expect(disposableRow).toHaveCount(1);
  await page.getByRole('button',{name:'Cancel'}).click();
  await expect(disposableRow).toHaveCount(1);
  await page.unroute(apiPattern);
  await page.getByRole('button',{name:'Delete Delete through Studio'}).click();
  await page.getByRole('button',{name:'Confirm Delete'}).click();
  await expect(disposableRow).toHaveCount(0);
  assert.equal(deletePayload?.id,'delete-through-studio','DELETE body identifies exactly the chosen scene');
  const disposableRecipe=path.join(host,'src/seene/scenes/delete-through-studio.scene.json');
  const disposableComponent=path.join(host,'src/seene/scenes/delete-through-studio.jsx');
  await expect.poll(async()=>Promise.all([readFile(disposableRecipe,'utf8').catch(()=>undefined),readFile(disposableComponent,'utf8').catch(()=>undefined)])).toEqual([undefined,undefined]);
  await page.reload();
  await expect(page.locator('[data-scene-id="delete-through-studio"]')).toHaveCount(0);

  for(const [id,title] of [['survey','Revised host survey'],['created-from-studio','Created from Studio']]){
   await page.getByRole('button',{name:`Delete ${title}`}).click();
   await page.getByRole('button',{name:'Confirm Delete'}).click();
   await expect(page.locator(`[data-scene-id="${id}"]`)).toHaveCount(0);
  }
  await expect(page.getByRole('heading',{name:'Your scenes will show up here.'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Your scenes will show up here.'})).toBeVisible();
 }
 if(kind!=='react'){
  dev.child.kill();await new Promise(r=>dev.child.once('exit',r));
  await run(process.execPath,['node_modules/next/dist/bin/next','build','--webpack']);
  for(const entry of await readdir(path.join(host,'.next/static'),{recursive:true}))if(entry.endsWith('.js')){
   const text=await readFile(path.join(host,'.next/static',entry),'utf8');
   assert.ok(!text.includes('Revised host survey'),'Production assets must exclude development recipes');
  }
  const production=await server(['start']);
  assert.equal((await fetch(production.url+'/seene')).status,404);
  await page.goto(production.url);await expect(page.getByRole('button',{name:'Count 0'})).toBeVisible();
 }
 console.log(kind+' passed.');
}catch(error){console.error(error);process.exitCode=1}
finally{await browser?.close();for(const child of children){if(typeof child.once==='function'){if(child.exitCode===null)await new Promise(resolve=>{child.once('exit',resolve);child.kill()})}else child.kill()}await rm(scratch,{recursive:true,force:true})}
