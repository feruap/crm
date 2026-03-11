const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    try {
        await page.goto('http://localhost:3000/automations', { waitUntil: 'networkidle' });
        const content = await page.content();
        console.log('Page body contains Loader2?', content.includes('animate-spin'));
        console.log('Page body contains Flujos de Automatización?', content.includes('Flujos de Automatización'));
        console.log('Page body contains Menus?', content.includes('MyAlice'));
    } catch (e) {
        console.error('Nav failed:', e);
    }

    await browser.close();
})();
