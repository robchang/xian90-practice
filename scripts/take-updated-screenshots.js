import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const screenshotsDir = path.join(__dirname, '..', 'screenshots-updated');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const screens = [
  { name: 'today', button: 0, filename: 'today-updated.png' },
  { name: 'speech', button: 1, filename: 'speech-updated.png' },
  { name: 'record', button: 2, filename: 'record-updated.png' }
];

async function takeScreenshots() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/usr/local/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));
    
    await page.setViewport({
      width: 390,
      height: 844,
      deviceScaleFactor: 2
    });

    console.log('Navigating to app...');
    await page.goto('http://localhost:5174', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });

    await page.waitForSelector('.app-nav', { timeout: 30000 });
    
    console.log('App loaded successfully!');

    for (const screen of screens) {
      console.log(`Capturing ${screen.name} screen...`);
      
      if (screen.button > 0) {
        const buttons = await page.$$('.app-nav button');
        if (buttons[screen.button]) {
          await buttons[screen.button].click();
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
      
      const screenshotPath = path.join(screenshotsDir, screen.filename);
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: false
      });
      console.log(`✓ Saved ${screen.filename}`);
    }

    console.log('\nAll updated screenshots captured!');
    console.log(`Screenshots saved to: ${screenshotsDir}`);

  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
}

takeScreenshots().catch(console.error);
