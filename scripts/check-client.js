const fs = require("node:fs");
const path = require("node:path");
const { validateRegistry } = require("../tests/validate");

// Paths
const schemaPath = path.resolve(__dirname, "../schema.json");
const registryPath = path.resolve(__dirname, "../v0/servers");

/**
 * Simulates how a client would convert our registry format
 * to a local mcp.json configuration.
 */
function simulateClient() {
	console.log("--- 🕵️ Client Registry Simulation ---");

	// 1. Load and Validate
	console.log("Step 1: Loading and validating registry file...");
	const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
	const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

	const result = validateRegistry(registry, schema);
	if (!result.valid) {
		console.error("❌ Registry is NOT valid! Client would fail to parse it.");
		result.errors.forEach((err) => {
			console.error(`  - ${err}`);
		});
		process.exit(1);
	}
	console.log("✅ Registry schema validation passed.");

	// 2. Transform to standard MCP config
	console.log(
		"\nStep 2: Transforming registry entries into mcp.json format...",
	);
	const clientConfig = {
		mcpServers: {},
	};

	for (const serverItem of registry.servers) {
		const server = serverItem.server;
		const id = server.name;
		// Simple heuristic: Use the first package if available
		if (server.packages && server.packages.length > 0) {
			const pkg = server.packages[0];
			const name = server.name.split("/").pop(); // use short name

			clientConfig.mcpServers[name] = {
				command: pkg.registryType === "npm" ? "npx" : pkg.identifier,
				args: pkg.registryType === "npm" ? ["-y", pkg.identifier] : [],
			};

			// Add arguments if they exist
			if (pkg.packageArguments) {
				pkg.packageArguments.forEach((arg) => {
					clientConfig.mcpServers[name].args.push(arg.value);
				});
			}
		} else if (server.remotes && server.remotes.length > 0) {
			// Remotes are handled differently by clients, but we can log them
			console.log(
				`ℹ️ Server "${id}" is a remote (SSE/Custom). Client would connect via URL.`,
			);
		}
	}

	console.log("✅ Conversion successful.");
	console.log("\n--- Generated Client Configuration (mcp.json) ---");
	console.log(JSON.stringify(clientConfig, null, 2));
	console.log("-----------------------------------------------");

	console.log(
		"\n✅ Test successful! The registry is providing valid, transformable server definitions.",
	);
}

simulateClient();
