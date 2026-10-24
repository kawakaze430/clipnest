import {defineConfig,devices} from '@playwright/test';
// CI uses Playwright's pinned Chromium. Prepared offline environments can select
// an existing browser explicitly; record its version with the resulting evidence.
const executablePath=process.env.CLIPNEST_CHROMIUM_EXECUTABLE_PATH;
export default defineConfig({testDir:'tests/browser',timeout:30000,fullyParallel:false,workers:1,retries:0,reporter:[['list'],['html',{open:'never'}]],use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',...(executablePath?{launchOptions:{executablePath}}:{})},webServer:{command:'node tests/acceptance-server.mjs',url:'http://127.0.0.1:4173/api/config',reuseExistingServer:false,timeout:90000},projects:[{name:'desktop-chromium',use:{...devices['Desktop Chrome']}},{name:'mobile-chromium',use:{...devices['Pixel 7']}}]});
