const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const registryPath = path.resolve(__dirname, '../v0/servers');

async function testServers() {
    console.log("--- 🚀 MCP Server Health Check ---");
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

    for (const [id, server] of Object.entries(registry.mcpServers)) {
        console.log(`\nTesting server: ${id}...`);

        if (!server.packages || server.packages.length === 0) {
            console.log(`⚠️ No packages defined for "${id}". Skipping.`);
            continue;
        }

        const pkg = server.packages[0];
        const command = pkg.registryType === 'npm' ? 'npx' : pkg.identifier;
        let args = pkg.registryType === 'npm' ? ['-y', pkg.identifier] : [];

        // Add dummy values for required placeholders
        if (pkg.packageArguments) {
            pkg.packageArguments.forEach(arg => {
                let val = arg.value;
                if (val.includes('${browser_url}')) val = val.replace('${browser_url}', 'http://localhost:9222');
                args.push(val);
            });
        }

        console.log(`Running: ${command} ${args.join(' ')}`);

        // Start the process
        const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'inherit'] });

        // Let it run for 3 seconds then kill it.
        // If it crashes immediately, it will fail.
        let output = '';
        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        const success = await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log(`✅ Server "${id}" started successfully (no immediate crash).`);
                child.kill();
                resolve(true);
            }, 3000);

            child.on('error', (err) => {
                clearTimeout(timeout);
                console.error(`❌ Error starting "${id}":`, err.message);
                resolve(false);
            });

            child.on('exit', (code) => {
                clearTimeout(timeout);
                if (code !== 0 && code !== null) {
                    console.error(`❌ Server "${id}" exited with code ${code}.`);
                    resolve(false);
                }
            });
        });

        if (!success) {
            console.error(`🚨 Health check failed for "${id}".`);
        }
    }

    console.log("\n--- Health Check Complete ---");
}

testServers();
