const { validateRegistry } = require('../tests/validate');
const fs = require('fs');
const path = require('path');

async function testHostedRegistry(url) {
    if (!url) {
        console.error("Usage: node scripts/test-hosted.js <URL>");
        process.exit(1);
    }

    console.log(`--- 🌐 Testing Hosted Registry at ${url} ---`);
    const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../schema.json'), 'utf8'));

    try {
        console.log("Fetching registry data...");
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log("✅ Registry JSON fetched successfully.");

        const result = validateRegistry(data, schema);
        if (result.valid) {
            console.log("\n✅ SUCCESS! The hosted registry is valid and ready for use.");
            console.log(`- Version: ${data.version}`);
            console.log(`- Servers count: ${Object.keys(data.mcpServers || {}).length}`);
        } else {
            console.error("\n❌ VALIDATION FAILED for hosted registry:");
            result.errors.forEach(err => console.error(`  - ${err}`));
            process.exit(1);
        }
    } catch (err) {
        console.error(`\n❌ ERROR: ${err.message}`);
        process.exit(1);
    }
}

const targetUrl = process.argv[2];
testHostedRegistry(targetUrl);
