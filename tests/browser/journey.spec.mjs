import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const axe=await readFile(new URL('../../node_modules/axe-core/axe.min.js',import.meta.url),'utf8');
test('account, qualities, keyboard selection, save, history, sign-out, mobile overflow and accessibility',async({page})=>{
 const email=`browser-${Date.now()}-${test.info().project.name}@example.test`,password='synthetic browser password';
 await page.goto('/');await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Create an account',exact:true}).click();await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByRole('button',{name:'My account',exact:true})).toBeVisible();
 await page.locator('#video-url').fill('https://youtu.be/aqz-KE-bpKQ');await page.getByRole('button',{name:'Find video'}).click();await expect(page.getByRole('radiogroup')).toBeVisible();const first=page.getByRole('radio',{checked:true});await first.focus();await page.keyboard.press('ArrowDown');await expect(page.getByRole('radio',{checked:true})).toBeFocused();
 await page.getByRole('button',{name:'Prepare download',exact:true}).click();await expect(page.getByRole('button',{name:'Save to device',exact:true})).toBeVisible({timeout:20000});
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Save to device',exact:true}).click();const download=await downloadEvent;expect(await download.failure()).toBeNull();expect(download.suggestedFilename()).toMatch(/\.mp4$/);
 await expect(page.locator('#history-list')).toContainText('Synthetic acceptance video');await page.evaluate(axe);const result=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();await page.getByRole('button',{name:'My account',exact:true}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();await expect(page.locator('#history-list')).not.toContainText('Synthetic acceptance video');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).last().click();await expect(page.getByRole('button',{name:'My account',exact:true})).toBeVisible();await expect(page.locator('#history-list')).toContainText('Synthetic acceptance video');
});
test('policy and recovery pages are responsive and accessible',async({page})=>{for(const path of ['/account.html#forgot','/privacy.html','/terms.html','/support.html']){await page.goto(path);await expect(page.locator('h1')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBeTruthy();await page.evaluate(axe);const r=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));expect(r.violations.map(v=>v.id)).toEqual([]);}});

async function newMember(page){const email=`recovery-${Date.now()}-${test.info().project.name}@example.test`,password='browser recovery fixture password';await page.goto('/');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Create an account',exact:true}).click();await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Create account',exact:true}).click();await expect(page.getByRole('button',{name:'My account',exact:true})).toBeVisible();return{email,password};}
async function qualities(page){await page.locator('#video-url').fill('https://youtu.be/aqz-KE-bpKQ');await page.getByRole('button',{name:'Find video'}).click();await expect(page.getByRole('radiogroup')).toBeVisible();}
test('cancel analysis and active preparation, then intentionally request again',async({page})=>{
 await newMember(page);
 // Keep the browser's analysis pending deterministically. The synthetic worker
 // can otherwise finish before Playwright observes sessionStorage. DELETE still
 // reaches the real API; subsequent qualities and downloads use actual responses.
 const analysisStatus='**/api/analyses/*';
 await page.route(analysisStatus,route=>route.request().method()==='GET'
  ?route.fulfill({json:{status:'running'}}):route.continue());
 await page.locator('#video-url').fill('https://youtu.be/aqz-KE-bpKQ');
 const created=page.waitForResponse(r=>r.url().endsWith('/api/analyses')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Find video'}).click();expect((await created).ok()).toBeTruthy();
 await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('clipnest-analysis'))).not.toBeNull();
 const cancelled=page.waitForResponse(r=>r.url().includes('/api/analyses/')&&r.request().method()==='DELETE');
 await page.locator('#cancel-analysis').click();expect((await cancelled).ok()).toBeTruthy();
 await expect(page.locator('#cancel-analysis')).toBeHidden();
 await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('clipnest-analysis'))).toBeNull();
 await expect(page.getByRole('button',{name:'Find video'})).toBeEnabled();
 await page.unroute(analysisStatus);
 await qualities(page);await page.getByRole('button',{name:'Prepare download',exact:true}).click();
 await page.locator('#cancel-job').click();
 await expect(page.locator('#job-panel')).toContainText('Download cancelled',{timeout:10000});
 await page.getByRole('button',{name:'Prepare download',exact:true}).click();
 await expect(page.getByRole('button',{name:'Save to device',exact:true})).toBeVisible({timeout:15000});
});
test('progress network failure, reload recovery and session-loss relogin',async({page,context})=>{const member=await newMember(page);await qualities(page);await page.route('**/api/jobs/*',route=>route.abort('internetdisconnected'));await page.getByRole('button',{name:'Prepare download',exact:true}).click();await expect(page.locator('#form-error')).toContainText('Progress updates paused');await page.unroute('**/api/jobs/*');await page.reload();await expect(page.locator('#history-list')).toContainText('Synthetic acceptance video',{timeout:15000});await expect(page.locator('#history-list')).toContainText('Ready on server',{timeout:15000});await context.clearCookies();await page.locator('[data-history="0"]').click();await expect(page.locator('#account-dialog')).toBeVisible();await expect(page.locator('#recent-count')).toHaveText('0');await page.getByLabel('Email address',{exact:true}).fill(member.email);await page.getByLabel('Password',{exact:true}).fill(member.password);await page.getByRole('button',{name:'Sign in',exact:true}).last().click();await expect(page.getByRole('button',{name:'My account',exact:true})).toBeVisible();await expect(page.locator('#history-list')).toContainText('Synthetic acceptance video');});
