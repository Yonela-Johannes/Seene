import {test,expect} from '@playwright/test';

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
 await expect(guide.getByText('npx @thatg33k/seene init')).toBeVisible();
 await expect(guide.getByText('hero-showcase.scene.json')).toBeVisible();
 await expect(guide.getByText('hero-showcase.tsx')).toBeVisible();
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
