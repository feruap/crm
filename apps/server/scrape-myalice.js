const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    console.log("Launching browser...");
    // Must be headless false so maybe that helps avoid anti-bot or network idle issues
    const browser = await chromium.launch({ headless: true });
    // Use an honest viewport
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    let foundUrl = null;

    // Monitor responses
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/messages') && response.request().method() === 'GET') {
            try {
                const body = await response.json();
                if (Array.isArray(body) || Array.isArray(body.dataSource)) {
                    console.log(`BINGO! Found messages URL: ${url}`);
                    foundUrl = url;
                    fs.writeFileSync('intercepted_messages.json', JSON.stringify({ url, messages: body }, null, 2));
                }
            } catch (e) { /* ignore JSON parsing errors */ }
        }
    });

    console.log("Navigating to MyAlice...");
    await page.goto('https://app.myalice.ai/', { waitUntil: 'load' });

    console.log("Logging in...");
    await page.fill('input[type="email"], input[name="email"]', 'fernando.ruiz@amunet.com.mx');
    await page.fill('input[type="password"], input[name="password"]', 'x7@p@@xhQvuJR2H');

    await page.click('button[type="submit"]');

    console.log("Waiting for dashboard...");
    await page.waitForTimeout(5000);
    console.log("Current URL:", page.url());

    // Attempt to navigate to the inbox implicitly by clicking the inbox icon
    // The sidebar usually has `a[href="/inbox"]` or similar
    console.log("Going to inbox...");
    await page.goto('https://app.myalice.ai/inbox', { waitUntil: 'load' });
    await page.waitForTimeout(5000);
    console.log("Inbox URL:", page.url());

    // click anywhere to dismiss any modals
    await page.mouse.click(10, 10);
    await page.waitForTimeout(2000);

    // Let's just click the first item in the middle panel
    // Based on standard inbox structures, it's usually a div with some padding/border
    console.log("Attempting to click a conversation in the list...");
    await page.evaluate(() => {
        // Find left panel or middle panel ticket list items
        let els = Array.from(document.querySelectorAll('div'));
        // Filter elements that look like a clickable conversation card
        els = els.filter(el => {
            const style = window.getComputedStyle(el);
            return style.cursor === 'pointer' && el.innerText.includes('AM') || el.innerText.includes('PM') || el.innerText.includes(':');
        });
        if (els.length > 0) {
            console.log("Clicking an element...");
            els[0].click();
        } else {
            // Fallback: click all reasonably sized divs with pointer cursor
            Array.from(document.querySelectorAll('div')).filter(el => {
                const rect = el.getBoundingClientRect();
                return window.getComputedStyle(el).cursor === 'pointer' && rect.height > 40 && rect.height < 150;
            }).slice(0, 3).forEach(el => el.click());
        }
    });

    await page.waitForTimeout(5000);

    console.log("Done checking.");
    await browser.close();
})();
