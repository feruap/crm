const { chromium } = require('playwright');
const axios = require('axios');
(async () => {
    const browser = await chromium.launch();
    const context = await browser.newContext();

    // Get token
    const login = await axios.post('http://localhost:3001/api/auth/login', { email: 'admin@myalice.ai', password: 'admin123' });
    const token = login.data.token;

    // Set token in localStorage for localhost:3000
    await context.addInitScript((t) => {
        window.localStorage.setItem('myalice_token', t);
    }, token);

    const page = await context.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    try {
        await page.goto('http://localhost:3000/automations', { waitUntil: 'networkidle' });
        await page.waitForTimeout(1000);
        const content = await page.content();
        console.log('Page body contains Loader2?', content.includes('animate-spin'));
        console.log('Page body contains Flujos de Automatización?', content.includes('Flujos de Automatización'));
        console.log('Page body contains Menus?', content.includes('MyAlice'));
        console.log('Page HTML snippet:', content.substring(content.length - 500));
    } catch (e) {
        console.error('Nav failed:', e);
    }

    await browser.close();
})();
