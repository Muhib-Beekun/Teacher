import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/ui',
    timeout: 15_000,
    retries: 0,
    use: {
        browserName: 'chromium',
        headless: true
    }
});
