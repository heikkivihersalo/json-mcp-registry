/**
 * External dependencies
 */
const fs = require("node:fs");
const path = require("node:path");

/**
 * Configuration constants
 */
const ROOT_DIR = path.resolve(__dirname, "../../");
const SERVERS_FILE = "servers";

/**
 * Compares two version strings (e.g., 'v1.0', 'v0.1') for descending order sorting.
 *
 * @param {string} a - The first version string.
 * @param {string} b - The second version string.
 * @return {number} The result of the comparison.
 */
function compareVersionsDescending(a, b) {
	const partsA = a.substring(1).split(".").map(Number);
	const partsB = b.substring(1).split(".").map(Number);
	const maxLength = Math.max(partsA.length, partsB.length);

	for (let i = 0; i < maxLength; i++) {
		const valA = partsA[i] || 0;
		const valB = partsB[i] || 0;
		if (valA !== valB) {
			return valB - valA;
		}
	}
	return 0;
}

/**
 * Finds the latest versioned directory (e.g., v0.1, v1.0).
 *
 * @return {string} The latest versioned directory name.
 */
function getLatestVersionDir() {
	const entries = fs.readdirSync(ROOT_DIR, { withFileTypes: true });

	const versionDirs = entries
		.filter((entry) => entry.isDirectory() && /^v\d+(\.\d+)*$/.test(entry.name))
		.map((entry) => entry.name)
		.sort(compareVersionsDescending);

	if (versionDirs.length === 0) {
		throw new Error("No versioned registry directories (e.g., v0.1) found.");
	}

	return versionDirs[0];
}

// Module state for caching
let cachedRegistryPath = null;

/**
 * @typedef {Object} Paths
 * @property {string} schema - Path to the schema file.
 * @property {string} registry - Path to the registry file.
 */

/**
 * @type {Paths}
 */
const paths = {
	schema: path.join(ROOT_DIR, "schema.json"),

	get registry() {
		// Cache the result so we only perform the synchronous I/O once
		if (!cachedRegistryPath) {
			const latestVersionDir = getLatestVersionDir();
			cachedRegistryPath = path.join(ROOT_DIR, latestVersionDir, SERVERS_FILE);
		}

		return cachedRegistryPath;
	},
};

module.exports = paths;
