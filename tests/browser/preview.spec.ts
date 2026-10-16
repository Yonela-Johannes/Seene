import {test,expect} from '@playwright/test';

test('site navigation menu works on desktop and mobile with keyboard and scroll handling',async({page})=>{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  await page.goto('/');
  const trigger=page.getByRole('button',{name:'Open navigation menu'});
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('button',{name:'Close navigation menu'})).toHaveAttribute('aria-expanded','true');
  const menu=page.getByRole('navigation',{name:'Site menu'});
  await expect(menu).toBeVisible();
  for(const [label,href] of [['Home','#/'],['Why I Built Seene','#demo'],['Demo','/tests/preview/walkthrough-fixture.html?seene-mode=scroll'],['Documentation / Getting Started','#install'],['GitHub','https://github.com/thatg33k-t33/Seene']]){
   await expect(menu.getByRole('link',{name:label,exact:true})).toHaveAttribute('href',href);
  }
  if(viewport.width<1024) await expect.poll(()=>page.locator('body').evaluate(element=>getComputedStyle(element).overflowY)).toBe('hidden');
  await page.getByRole('button',{name:'Close navigation menu'}).click();
  await expect(page.getByRole('button',{name:'Open navigation menu'})).toHaveAttribute('aria-expanded','false');
  await page.getByRole('button',{name:'Open navigation menu'}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Open navigation menu'})).toHaveAttribute('aria-expanded','false');
  await expect(page.getByRole('button',{name:'Open navigation menu'})).toBeFocused();
  await expect.poll(()=>page.locator('body').evaluate(element=>getComputedStyle(element).overflowY)).not.toBe('hidden');
  await page.getByRole('button',{name:'Open navigation menu'}).click();
  await menu.getByRole('link',{name:'Why I Built Seene'}).click();
  await expect(page).toHaveURL(/#demo$/);
  await expect(page.getByRole('button',{name:'Open navigation menu'})).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#demo')).toBeInViewport();
  await page.locator('#demo').getByRole('button',{name:'Website Walkthrough'}).click();
  await expect(page.locator('[data-testid^="home-demo-story-"]')).toHaveCount(5);
 }
});

test('homepage demo presents the founder story in its existing walkthrough preview',async({page})=>{
 await page.goto('/#/story');
 await expect(page.getByRole('heading',{name:'Present your React interfaces as cinematic scenes.'})).toBeVisible();
 await expect(page.locator('.founder-story-page')).toHaveCount(0);
 await page.goto('/#demo');
 await expect(page.locator('#demo')).toBeInViewport();
 await page.locator('#demo').getByRole('button',{name:'Website Walkthrough'}).click();
 const screens=page.locator('[data-testid^="home-demo-story-"]');
 await expect(screens).toHaveCount(5);
 await expect(screens.nth(0)).toContainText('Every project deserved to be seen.');
 await expect(screens.nth(4)).toContainText('So I built Seene.');
 await expect(page.getByRole('region',{name:'Overview'}).getByRole('link',{name:'Watch the demo',exact:true})).toHaveAttribute('href','/tests/preview/walkthrough-fixture.html?seene-mode=scroll');
 await expect(page.getByRole('link',{name:'Experience Seene'})).toHaveAttribute('href','#install');
 await page.getByRole('button',{name:'Open navigation menu'}).click();
 await page.getByRole('navigation',{name:'Site menu'}).getByRole('link',{name:'Demo',exact:true}).click();
 await expect(page).toHaveURL(/\/tests\/preview\/walkthrough-fixture\.html\?seene-mode=scroll$/);
 await expect(page.getByRole('navigation',{name:'Primary'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Why I Built Seene'})).toBeVisible();
 await expect(page.getByTestId('scene-time')).toHaveText('0:00 / 0:20');
 await page.goto('/#demo');
 await page.getByRole('button',{name:'Open navigation menu'}).click();
 await page.getByRole('navigation',{name:'Site menu'}).getByRole('link',{name:'Home'}).click();
 await expect(page).toHaveURL(/#\/$/);
 await expect(page.getByRole('heading',{name:'Present your React interfaces as cinematic scenes.'})).toBeVisible();
});

test('walkthrough scroll maps frame 0, midpoint and end on a flat sharp canvas',async({page})=>{
 await page.goto('/tests/preview/walkthrough-fixture.html?seene-mode=scene&seene-preset=overview');
 const oldSlider=page.getByRole('slider',{name:'Scene time'});
 await expect(page.getByRole('button',{name:'Overview',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:'test-results/walkthrough-before-frame-0.png'});
 await oldSlider.fill('3000');
 await page.screenshot({path:'test-results/walkthrough-before-frame-mid.png'});
 await oldSlider.fill('6000');
 await page.screenshot({path:'test-results/walkthrough-before-frame-end.png'});
 await page.goto('/tests/preview/walkthrough-fixture.html?seene-mode=scroll&seene-preset=overview');
 const viewport=page.locator('.website-walkthrough-viewport');
 const slider=page.getByRole('slider',{name:'Scene time'});
 await expect(page.getByRole('navigation',{name:'Primary'})).toBeVisible();
 await expect(page.locator('.demo-founder-story-screen-full .seene-frame')).toHaveCount(5);
 await expect.poll(()=>page.evaluate(()=>{const section=document.querySelector('.demo-founder-story-screen')!;const frame=section.querySelector('.seene-frame')!;return Math.abs(section.getBoundingClientRect().width-frame.getBoundingClientRect().width)})).toBeLessThanOrEqual(1);
 await expect.poll(()=>page.evaluate(()=>Math.abs(document.querySelector('.seene-site-header .seene-frame-row')!.getBoundingClientRect().width-document.querySelector('.demo-founder-story-screen')!.getBoundingClientRect().width))).toBeLessThanOrEqual(1);
 await expect.poll(()=>page.evaluate(()=>Math.abs(document.querySelector('.seene-site-header [aria-label="Seene home"]')!.getBoundingClientRect().left-document.querySelector('.demo-founder-story-screen .demo-founder-story-kicker')!.getBoundingClientRect().left))).toBeLessThanOrEqual(1);
 await expect.poll(()=>page.evaluate(()=>{const screens=[...document.querySelectorAll('.demo-founder-story-screen')];const railPositions=(container:ParentNode,selector:string)=>[...container.querySelectorAll(selector)].map(rail=>Math.round(rail.getBoundingClientRect().left+rail.getBoundingClientRect().width/2));const header=railPositions(document.querySelector('.seene-site-header')!,'.seene-rail');return screens.slice(1,4).every(screen=>JSON.stringify(railPositions(screen,'[data-seene-rail]'))===JSON.stringify(header))})).toBe(true);
 const storyTitles=[
  'Every project deserved to be seen.',
  'Press record. Start scrolling.',
  "The work was good. The process wasn't.",
  'There had to be a better way.',
  'So I built Seene.',
 ];
 const storyBodies=[
  'I wanted to showcase the actual websites and projects I built, from beginning to end.',
  "Every time I wanted to demonstrate a project, I'd activate the screen recorder and manually scroll from the top of the website to the bottom.",
  'The scrolling was inconsistent, and getting the pacing right required repeated manual effort.',
  'I wanted a tool I could install in a project, configure, and reuse whenever I needed a consistent presentation.',
  'Seene turns website presentations into a more deliberate, controlled, and repeatable process.',
 ];
 expect(await page.locator('[data-testid^="walkthrough-section-"] h1').allTextContents()).toEqual(storyTitles);
 expect(await page.locator('[data-testid^="walkthrough-section-"] h1 + p').allTextContents()).toEqual(storyBodies);
 await expect(page.getByRole('button',{name:'Scroll',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Scene',exact:true})).toHaveAttribute('aria-pressed','false');
 await expect(page.getByRole('button',{name:'Overview',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Overview',exact:true})).toHaveAttribute('title','Presets apply in Scene mode');
 await expect(slider).toHaveAttribute('max','20000');
 await expect(page.getByTestId('scene-time')).toHaveText('0:00 / 0:20');
 await expect(page.locator('.website-walkthrough-timeline-controls')).toHaveCount(0);
 await expect(page.locator('[data-seene-capture="scene"]')).toHaveAttribute('data-seene-valid','true');
 await expect(page.locator('[data-seene-id="host"]')).toHaveAttribute('data-seene-blur','0');
 await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.has('seene-preset'))).toBe(false);
 await expect.poll(async()=>page.evaluate(()=>{const element=document.querySelector('.website-walkthrough-viewport') as HTMLElement;return element.scrollHeight-element.clientHeight-element.clientHeight*4})).toBe(0);
 const geometry=await page.evaluate(()=>{
  const selectors=['.website-walkthrough','.website-walkthrough-full-page','.website-walkthrough-viewport','.seene-canvas','[data-seene-scene]','[data-seene-stage]','[data-seene-id="host"]'];
  return selectors.map(selector=>{const element=document.querySelector(selector) as HTMLElement;const style=getComputedStyle(element);return {selector,height:style.height,scrollHeight:element.scrollHeight,clientHeight:element.clientHeight,scrollTop:element.scrollTop,transform:style.transform,perspective:style.perspective,filter:style.filter,blur:element.getAttribute('data-seene-blur')}});
 });
 const scrollMetrics=geometry.find(value=>value.selector==='.website-walkthrough-viewport')!;
 expect(scrollMetrics.scrollHeight).toBe(scrollMetrics.clientHeight*5);
 expect(geometry.find(value=>value.selector==='[data-seene-id="host"]')).toMatchObject({height:`${scrollMetrics.clientHeight*5}px`,blur:'0',filter:'none'});
 expect(geometry.find(value=>value.selector==='[data-seene-stage]')?.transform).toBe('matrix(1, 0, 0, 1, 0, 0)');
 await slider.fill('0');
 await expect.poll(()=>viewport.evaluate(element=>(element as HTMLElement).scrollTop)).toBe(0);
 await expect(page.getByTestId('walkthrough-section-0')).toBeInViewport();
 await page.screenshot({path:'test-results/walkthrough-frame-0.png'});
 await slider.fill('10000');
 await expect.poll(()=>viewport.evaluate(element=>{const item=element as HTMLElement;return Math.abs(item.scrollTop-(item.scrollHeight-item.clientHeight)/2)})).toBeLessThanOrEqual(2);
 await expect(page.getByTestId('walkthrough-section-2')).toBeInViewport();
 await page.screenshot({path:'test-results/walkthrough-frame-mid.png'});
 await slider.fill('20000');
 await expect.poll(()=>viewport.evaluate(element=>{const item=element as HTMLElement;return Math.abs(item.scrollTop-(item.scrollHeight-item.clientHeight))})).toBeLessThanOrEqual(2);
 await expect(page.getByTestId('walkthrough-section-4')).toBeVisible();
 await expect(page.getByRole('link',{name:'Experience Seene'})).toBeVisible();
 await page.screenshot({path:'test-results/walkthrough-frame-end.png'});
});

test('walkthrough mode, presets, Inspector, timeline and Export controls stay synchronized',async({page})=>{
 await page.goto('/tests/preview/walkthrough-fixture.html?seene-mode=scroll');
 await page.evaluate(() => localStorage.clear());
 await page.reload();
 const slider=page.getByRole('slider',{name:'Scene time'});
 await slider.fill('10000');
 await page.getByRole('button',{name:'Scene',exact:true}).click();
 await expect(page).toHaveURL(/seene-mode=scene/);
 await expect(slider).toHaveValue('10000');
 const presetNames=['Clean','Depth','Cinematic','Floating','Focus','Showcase','Minimal','Orbit','Reveal','Product Tour','Editorial','Parallax','Dramatic Push','Overview','Detail Focus'];
 const cameraSignatures=new Set<string>();
 for(const name of presetNames){
  const preset=page.getByRole('button',{name,exact:true});
  await expect(preset).toBeEnabled();
      const before=await page.locator('[data-seene-stage]').evaluate(element=>`${getComputedStyle(element).transform}|${getComputedStyle(element.parentElement!).perspective}`);
  await preset.click();
  await expect(preset).toHaveAttribute('aria-pressed','true');
    await expect(preset).toHaveClass(/seene-primary/);
  await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.has('seene-preset'))).toBe(true);
      await expect.poll(()=>page.locator('[data-seene-stage]').evaluate(element=>`${getComputedStyle(element).transform}|${getComputedStyle(element.parentElement!).perspective}`)).not.toBe(before);
      cameraSignatures.add(await page.locator('[data-seene-stage]').evaluate(element=>`${getComputedStyle(element).transform}|${getComputedStyle(element.parentElement!).perspective}`));
 }
 expect(cameraSignatures.size).toBe(presetNames.length);
 await page.getByRole('button',{name:'Authored',exact:true}).click();
 await expect(page.getByRole('button',{name:'Authored',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Authored',exact:true})).toHaveClass(/seene-primary/);
 await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.has('seene-preset'))).toBe(false);
 await page.getByRole('button',{name:'Detail Focus',exact:true}).click();
 await page.reload();
 await expect(page.getByRole('button',{name:'Detail Focus',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect.poll(()=>page.evaluate(()=>new URL(location.href).searchParams.get('seene-preset'))).toBe('detail-focus');
 await page.getByRole('button',{name:'Scroll',exact:true}).click();
 await expect(page).toHaveURL(/seene-mode=scroll/);
 await expect(page).not.toHaveURL(/seene-preset=/);
 await expect(page.getByRole('button',{name:'Overview',exact:true})).toBeDisabled();
 await page.reload();
 await expect(page.getByRole('button',{name:'Scroll',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('button',{name:'Overview',exact:true})).toBeDisabled();
 await expect(page).not.toHaveURL(/seene-preset=/);

 await page.getByRole('button',{name:'Scene Inspector'}).click();
 await expect(page.getByRole('button',{name:'Close Inspector',exact:true})).toHaveAttribute('aria-expanded','true');
 await page.getByLabel('Walkthrough duration (seconds)').fill('42');
 await expect(slider).toHaveAttribute('max','42000');
 await page.getByLabel('Walkthrough easing').selectOption('ease-in-out');
 await page.getByLabel('Hold at top (seconds)').fill('2');
 await page.getByLabel('Hold at bottom (seconds)').fill('1');
 await page.getByLabel('Walkthrough start offset').fill('100');
 await page.getByLabel('Walkthrough end offset').fill('05 / Closing');
 await page.getByLabel('Autoplay walkthrough').check();
 await page.getByTestId('seene-inspector-save').click();
 await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('walkthrough-fixture-definition') ?? '{}').walkthroughSettings?.holdAtTopMs)).toBe(2000);
 await page.keyboard.press('Escape');
 await expect(page.getByRole('button',{name:'Scene Inspector'})).toHaveAttribute('aria-expanded','false');
 await expect(page.getByRole('button',{name:'Scene Inspector'})).toBeFocused();
 await page.reload();
 await page.getByRole('button',{name:'Scene Inspector'}).click();
 await expect(page.getByLabel('Walkthrough duration (seconds)')).toHaveValue('42');
 await expect(page.getByLabel('Walkthrough easing')).toHaveValue('ease-in-out');
 await expect(page.getByLabel('Hold at top (seconds)')).toHaveValue('2');
 await expect(page.getByLabel('Hold at bottom (seconds)')).toHaveValue('1');
 await expect(page.getByLabel('Walkthrough start offset')).toHaveValue('100');
 await expect(page.getByLabel('Walkthrough end offset')).toHaveValue('05 / Closing');
 await expect(page.getByLabel('Autoplay walkthrough')).toBeChecked();
 await page.getByRole('button',{name:'Close inspector',exact:true}).click();

 await page.getByRole('button',{name:'Restart'}).click();
 await expect(slider).toHaveValue('0');
 await expect.poll(()=>page.locator('.website-walkthrough-viewport').evaluate(element=>element.scrollTop)).toBe(100);
 await slider.focus();
 await page.keyboard.press('ArrowRight');
 await expect(slider).toHaveValue('10');
 await slider.fill('41990');
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Replay',exact:true})).toBeVisible({timeout:3000});
 await page.getByRole('button',{name:'Restart'}).click();
 await page.locator('.seene-export summary').click();
 await expect(page.getByRole('region',{name:'Export your scene'})).toBeVisible();
 await page.getByRole('combobox',{name:'Export frame rate'}).selectOption('30');
 await expect(page.locator('.seene-export-panel code')).toContainText('--fps 30');
});

test('public landing page documents installation, scene authoring, discovery and framework-specific preview',async({page})=>{
 await page.goto('/');
 await expect(page).toHaveTitle('Seene — cinematic scenes for real React interfaces');
 await expect(page.getByRole('heading',{name:'Present your React interfaces as cinematic scenes.'})).toBeVisible();
 await expect(page.getByText('Requires Node 22.12+ and React 18.2+ or 19. Installs as @thatg33k/seene.')).toBeVisible();
 await page.getByLabel('Overview').getByRole('link',{name:'Get started'}).click();
 await expect(page).toHaveURL(/#install$/);
 await expect(page.getByRole('heading',{name:'Simple Setup in Minutes'})).toBeVisible();
 const guide=page.getByLabel('Workflow');
 await expect(guide.getByText('STEP 01')).toBeVisible();
 await expect(guide.getByText('STEP 02')).toBeVisible();
 await expect(guide.getByText('STEP 03')).toBeVisible();
 await expect(guide.getByRole('heading',{name:'Initialize Seene in Your Project'})).toBeVisible();
 await expect(guide.getByRole('heading',{name:'Author a Recipe and Component'})).toBeVisible();
 await expect(guide.getByRole('heading',{name:'Open Studio & Compose Motion'})).toBeVisible();
 await expect(guide.getByText(/Choose Website Walkthrough in Create Scene/)).toBeVisible();
 await expect(guide.getByText(/seeneCreateScenePlugin\(\)/)).toBeVisible();
 await expect(guide.getByText('npx @thatg33k/seene init')).toBeVisible();
 await expect(guide.getByText('hero-showcase.scene.json')).toBeVisible();
 await expect(guide.getByText('hero-showcase.tsx')).toBeVisible();
 const exampleRecipe=JSON.parse((await guide.locator('pre code').nth(0).textContent())!);
 expect(exampleRecipe.id).toBe('hero-showcase');
 expect(exampleRecipe.definition.motion.tracks).toHaveLength(1);
 await expect(guide.locator('pre code').nth(1)).toContainText('../../components/HeroSection');
 await expect(guide.getByText('npx seene open --url http://localhost:3000')).toBeVisible();
 await expect(guide.getByText('npx seene open --url http://localhost:5173')).toBeVisible();
});
test('one product shell preserves real host context and state through seek and playback controls',async({page})=>{
 let requests=0;page.on('request',request=>{if(request.url().endsWith('/data.json'))requests++});
 await page.goto('/tests/preview/fixture.html');
 // A real request is supplied by the fixture, not by the preview renderer.
 await expect(page.getByRole('heading',{name:'Provider content'})).toBeVisible();
 await expect(page.getByRole('alert')).toHaveCount(0);
 await page.getByRole('button',{name:'Count 0',exact:true}).click();
 await expect(page.getByRole('button',{name:'Count 1',exact:true})).toBeVisible();
 await page.evaluate(()=>{(window as any).originalHost=document.querySelector('[data-testid="host"]')});
 const seek=page.getByRole('slider',{name:'Scene time'});
 await seek.fill('4000');
 await expect(page.getByTestId('scene-time')).toHaveText('0:04 / 0:08');
 expect(await page.evaluate(()=>(window as any).originalHost===document.querySelector('[data-testid="host"]'))).toBe(true);
 expect(requests).toBe(1);
 await page.evaluate(async()=>{await (window as any).__SEENE_CAPTURE__.seek(2000)});
 await expect(seek).toHaveValue('2000');
 await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
 await expect(page.locator('[data-seene-capture="scene"]')).toHaveAttribute('data-seene-valid','true');
 await seek.fill('8000');
 await page.getByRole('button',{name:'Replay',exact:true}).click();
 await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.getByRole('button',{name:'Restart',exact:true}).click();
 await expect(seek).toHaveValue('0');
 await page.locator('.seene-export summary').click();
 await page.getByRole('combobox',{name:'Export frame rate'}).selectOption('30');
 await expect(page.locator('.seene-export-panel code')).toContainText('--fps 30');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{if(!(window as any).copyRetried){(window as any).copyRetried=true;throw new Error('Denied')}}}}));
 await page.getByRole('button',{name:'Copy command'}).click();
 await expect(page.getByRole('region',{name:'Export your scene'}).getByRole('status')).toContainText('Select and copy');
 await page.getByRole('button',{name:'Copy command'}).click();
 await expect(page.getByRole('button',{name:'Copied',exact:true})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('.seene-export summary')).toBeFocused();
 await page.emulateMedia({reducedMotion:'reduce'});
 await expect(page.getByRole('button',{name:'Play',exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});

test('scene cover fills every viewport and the bottom backdrop progressively blurs real pixels',async({page})=>{
 await page.goto('/tests/preview/fixture.html');
 await expect(page.getByRole('button',{name:'Play',exact:true})).toBeEnabled();
 for(const size of [{width:1920,height:1080},{width:390,height:844},{width:667,height:320}]){
  await page.setViewportSize(size);
  await expect.poll(()=>page.locator('[data-seene-capture="scene"]').boundingBox()).toEqual({x:0,y:0,...size});
  await expect.poll(async()=>(await page.locator('[data-seene-scene]').boundingBox())!.width).toBeGreaterThanOrEqual(size.width-1);
  await expect.poll(async()=>(await page.locator('[data-seene-scene]').boundingBox())!.height).toBeGreaterThanOrEqual(size.height-1);
  const geometry=await page.locator('[data-seene-scene]').boundingBox();
  expect(geometry!.width/geometry!.height).toBeCloseTo(1400/980,3);
 }
 await page.setViewportSize({width:1440,height:1000});
 // A diagnostic pattern on the actual capture viewport isolates backdrop blur
 // from scene depth of field. A tint/gradient alone cannot remove stripe contrast.
 await page.addStyleTag({content:'.seene-canvas{background:repeating-linear-gradient(90deg,#000 0 12px,#fff 12px 24px)!important}.seene-canvas>*{visibility:hidden}'});
 const contrast=async()=>{
  const shot=await page.screenshot();
  return page.evaluate(async data=>{
   const img=new Image();img.src=data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(img,0,0);
   return [650,760,940].map(y=>{const p=ctx.getImageData(24,y,48,4).data;const values=Array.from({length:p.length/4},(_,i)=>p[i*4]);return Math.max(...values)-Math.min(...values)});
  },'data:image/png;base64,'+shot.toString('base64'));
 };
 // ResizeObserver layout and Chromium's backdrop compositor settle separately.
 // Wait for the rendered result after rapid viewport changes; retain every pixel
 // assertion so missing blur, flat blur and tint-only replacements still fail.
 await expect(async()=>{
  const blurred=await contrast();
  expect(blurred[0]).toBeGreaterThan(240);
  expect(blurred[1]).toBeLessThan(blurred[0]-30);
  expect(blurred[2]).toBeLessThan(blurred[1]-30);
  expect(blurred[2]).toBeLessThan(20);
 }).toPass({timeout:7000});
 await page.addStyleTag({content:'.seene-bottom-blur i{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'});
 await expect.poll(async()=>(await contrast())[2]).toBeGreaterThan(150);
});

test('landing page remains usable at narrow viewports and its install call to action is reachable',async({page})=>{
 await page.goto('/');
 await expect(page).toHaveTitle('Seene — cinematic scenes for real React interfaces');
 for(const size of [{width:1440,height:1000},{width:390,height:844},{width:667,height:320},{width:320,height:568}]){
  await page.setViewportSize(size);
  const start=page.getByLabel('Overview').getByRole('link',{name:'Get started'});
  await start.scrollIntoViewIfNeeded();
  await expect(start).toBeInViewport();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(size.width);
 }
 await page.getByLabel('Overview').getByRole('link',{name:'Get started'}).focus();
 await expect(page.getByLabel('Overview').getByRole('link',{name:'Get started'})).toBeFocused();
 await page.screenshot({path:'test-results/seene-landing-mobile.png'});
});

test('local studio explains its project registration flow using the platform API',async({page})=>{
 let requests=0;
 await page.route('**/__seene/platform/projects',async route=>{
  if(route.request().method()==='GET'){
   requests++;
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({home:'/tmp/seene-browser-fixture',projects:[]})});
  } else await route.continue();
 });
 await page.goto('/#/projects');
 await expect(page.getByRole('heading',{name:'Local studio'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Your projects'})).toBeVisible();
 await expect(page.getByText('No projects registered yet')).toBeVisible();
 await expect(page.getByRole('form',{name:'Register project'})).toBeVisible();
 await expect(page.getByLabel('Project folder path')).toBeVisible();
 await expect(page.getByRole('button',{name:/Register project/})).toBeDisabled();
 await expect(page.getByRole('link',{name:'Back to overview'})).toHaveAttribute('href','#/');
 expect(requests).toBe(1);
});
