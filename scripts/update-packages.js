/**
 * External dependencies
 */
const fs = require("node:fs");
const { execSync } = require("node:child_process");

/**
 * Internal dependencies
 */
const paths = require("../tests/utils/paths");

/**
 * Update the registry file with the latest npm package versions.
 */
function updatePackages() {
	const registryPath = paths.registry;
	const currentRegistry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
	let hasUpdates = false;

	console.log(`Checking for updates in: ${registryPath}`);

	for (const entry of currentRegistry.servers) {
		const server = entry.server;

		// Check if the server has any npm packages
		const npmPackage = (server.packages || []).find(
			(p) => p.registryType === "npm",
		);

		if (npmPackage) {
			const packageName = npmPackage.identifier;
			try {
				// Use npm view to get the latest version from registry
				const latestVersion = execSync(`npm view ${packageName} version`, {
					encoding: "utf8",
					stdio: ["ignore", "pipe", "ignore"],
				}).trim();

				if (server.version !== latestVersion) {
					console.log(
						`🚀 Updating ${server.name} (${packageName}) from ${server.version} to ${latestVersion}`,
					);
					server.version = latestVersion;
					hasUpdates = true;
				} else {
					console.log(
						`✅ ${server.name} (${packageName}) is up to date (${latestVersion})`,
					);
				}
			} catch (error) {
				console.error(
					`❌ Failed to fetch version for ${packageName}:`,
					error.message,
				);
			}
		}
	}

	if (hasUpdates) {
		// Update the count just in case someone changed it manually (also verified in tests)
		currentRegistry.metadata.count = currentRegistry.servers.length;

		fs.writeFileSync(
			registryPath,
			`${JSON.stringify(currentRegistry, null, 2)}\n`,
		);
		console.log("\n✨ Registry updated successfully!");
	} else {
		console.log("\n📦 All npm packages are up to date.");
	}
}

// Check if we are being run directly
if (require.main === module) {
	updatePackages();
}

module.exports = { updatePackages };
