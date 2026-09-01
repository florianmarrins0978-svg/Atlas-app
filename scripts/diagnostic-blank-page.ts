import { chromium } from 'playwright';

async function diagnoseBlankPage() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium',
  });
  const page = await browser.newPage();

  const messages: { type: string; text: string }[] = [];

  // Capture all console messages
  page.on('console', (msg) => {
    messages.push({ type: msg.type(), text: msg.text() });
    console.log(`[${msg.type().toUpperCase()}] ${msg.text()}`);
  });

  // Capture JavaScript errors
  page.on('pageerror', (error) => {
    console.error('[ERROR]', error);
  });

  try {
    console.log('Loading http://localhost:3000/login...');
    const response = await page.goto('http://localhost:3000/login', {
      waitUntil: 'load',
      timeout: 15000,
    });

    console.log(`Response status: ${response?.status()}`);

    // Wait for the page to render
    await page.waitForTimeout(2000);

    // Check if main content is visible
    const mainContent = await page.$('main');
    if (mainContent) {
      const isVisible = await mainContent.isVisible();
      console.log(`Main content visible: ${isVisible}`);

      // Get the text content
      const text = await mainContent.textContent();
      console.log(`Main text content length: ${text?.length || 0}`);
      if (text?.length === 0) {
        console.error('❌ Main content is empty (blank page)');
      } else {
        console.log('✅ Main content has text');
      }
    } else {
      console.error('❌ No <main> element found');
    }

    // Check for errors in the page
    const pageData = await page.evaluate(() => {
      const errors: any[] = [];
      // Check for any error messages in the DOM
      const errorElements = document.querySelectorAll('[role="alert"]');
      errorElements.forEach((el) => {
        errors.push({
          role: 'alert',
          text: el.textContent,
          html: el.innerHTML,
          className: el.className,
        });
      });

      // Check for form elements
      const form = document.querySelector('form');
      const inputs = document.querySelectorAll('input');
      const buttons = document.querySelectorAll('button');

      return {
        errors,
        formFound: !!form,
        inputsCount: inputs.length,
        buttonsCount: buttons.length,
        htmlLength: document.documentElement.outerHTML.length,
      };
    });

    console.log('Page data:', pageData);

    if (pageData.errors.length > 0) {
      console.log('Errors found on page:', pageData.errors);
    }

    // Dump all console messages
    console.log('\n=== All Console Messages ===');
    for (const msg of messages) {
      console.log(`[${msg.type}] ${msg.text}`);
    }
  } catch (error) {
    console.error('Error during diagnostics:', error);
  }

  await browser.close();
}

diagnoseBlankPage().catch(console.error);
