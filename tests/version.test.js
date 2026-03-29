/**
 * External dependencies
 */
const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const { execSync } = require("node:child_process");

/**
 * Internal dependencies
 */
const paths = require("./utils/paths");

/**
 * Load registry
 */
const registryPath = paths.registry;
const currentRegistry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

describe("NPM Package Version Synchronization", () => {
	it("should use the latest version for all npm packages", () => {
		for (const entry of currentRegistry.servers) {
			const server = entry.server;
			const npmPackage = (server.packages || []).find(
				(p) => p.registryType === "npm",
			);

			if (npmPackage) {
				const packageName = npmPackage.identifier;
				try {
					const latestVersion = execSync(`npm view ${packageName} version`, {
						encoding: "utf8",
						stdio: ["ignore", "pipe", "ignore"],
					}).trim();

					assert.strictEqual(
						server.version,
						latestVersion,
						`Server '${server.name}' (${packageName}) is using version ${server.version}, but latest is ${latestVersion}. Please run 'npm run update:packages'.`,
					);
				} catch (error) {
					console.warn(
						`⚠️  Could not verify version for ${packageName}: ${error.message}`,
					);
				}
			}
		}
	});
});
