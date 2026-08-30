const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
  
  await page.goto('http://localhost:5173/physical', { waitUntil: 'networkidle0' }).catch(e => console.log("GOTO ERROR", e));
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
