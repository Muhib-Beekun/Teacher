#!/usr/bin/env node
import fs from 'fs';
import puppeteer from 'puppeteer';
import { startHarness } from './web-app-harness.mjs';

const harness = await startHarness(0);
const { port, url, stop } = harness;

function chromeExecutable() {
    const candidates = [
        process.env.CHROME_PATH,
        process.env.PUPPETEER_EXECUTABLE_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
    ].filter(Boolean);
    return candidates.find((p) => fs.existsSync(p));
}

let failed = false;
function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        failed = true;
    }
}

try {
    const executablePath = chromeExecutable();
    const browser = await puppeteer.launch({
        headless: true,
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 });

    const title = await page.title();
    assert(title.includes('Teacher'), `expected title to include Teacher, got ${title}`);

    await page.waitForSelector('#brief');
    await page.waitForSelector('#status');

    const healthText = await page.evaluate(async () => {
        const h = await fetch('/health').then((r) => r.json());
        return h.ok && h.stt === 'webspeech';
    });
    assert(healthText, 'health check failed in browser');

    // Add segment via API (simulates speech send path)
    await page.evaluate(async () => {
        const res = await fetch('/api/segment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'Fix the login bug in auth.ts without breaking tests' })
        });
        const json = await res.json();
        window.__lastSession = json.session;
    });

    await page.evaluate(async () => {
        const res = await fetch('/api/session');
        const json = await res.json();
        document.getElementById('brief').innerHTML = json.session.briefHtml || '<p class="empty">empty</p>';
        window.__briefMarkdown = json.session.compiled;
    });

    const compiled = await page.evaluate(() => window.__briefMarkdown || '');
    assert(compiled.includes('login') || compiled.length > 10, `compiled brief missing content: ${compiled.slice(0, 80)}`);

    const segmentCount = await page.evaluate(async () => {
        const res = await fetch('/api/session');
        return (await res.json()).session.segmentCount;
    });
    assert(segmentCount === 1, `expected 1 segment, got ${segmentCount}`);

    // Second segment via API
    await page.evaluate(async () => {
        await fetch('/api/segment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: 'Add dark mode toggle to settings page' })
        });
    });
    await page.waitForFunction(() => {
        return fetch('/api/session').then((r) => r.json()).then((j) => j.session.segmentCount >= 2);
    }, { timeout: 5000 });

    const countAfterType = await page.evaluate(async () => {
        const res = await fetch('/api/session');
        return (await res.json()).session.segmentCount;
    });
    assert(countAfterType >= 2, `second segment failed: count=${countAfterType}`);

    // Copy brief button
    await page.evaluate(() => {
        navigator.clipboard.writeText = async (text) => {
            window.__copied = text;
            return undefined;
        };
    });
    await page.click('#copy');
    await page.waitForFunction(() => window.__copied && window.__copied.length > 10, { timeout: 3000 });
    const copied = await page.evaluate(() => window.__copied);
    assert(copied && copied.length > 10, 'copy brief did not populate clipboard');

    const statusAfterCopy = await page.$eval('#status', (el) => el.textContent);
    assert(statusAfterCopy.toLowerCase().includes('copied'), `copy status unexpected: ${statusAfterCopy}`);

    await browser.close();

    if (failed) {
        process.exitCode = 1;
        console.error('web-app tests had failures');
    } else {
        console.log('web-app puppeteer test passed');
    }
} finally {
    stop();
}
