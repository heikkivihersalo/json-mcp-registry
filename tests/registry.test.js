/**
 * External dependencies
 */
const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");

/**
 * Internal dependencies
 */
const paths = require("./utils/paths");
const { validateRegistry } = require("./utils/validate");

/**
 * Load static files once
 */
const schema = JSON.parse(fs.readFileSync(paths.schema, "utf8"));
const currentRegistry = JSON.parse(fs.readFileSync(paths.registry, "utf8"));

describe("Current Live Registry Validation", () => {
	it("should pass schema validation and secret checks", () => {
		const result = validateRegistry(currentRegistry, schema);
		if (!result.valid) {
			console.error("Validation Errors:", result.errors);
		}
		assert.strictEqual(result.valid, true, "Current registry should be valid.");
	});

	it("should have matching metadata counts", () => {
		const serverCount = currentRegistry.servers.length;
		const metadataCount = currentRegistry.metadata.count;
		assert.strictEqual(
			serverCount,
			metadataCount,
			`Metadata count (${metadataCount}) should match actual servers count (${serverCount})`,
		);
	});

	it("should enforce unique server names", () => {
		const names = currentRegistry.servers.map((s) => s.server.name);
		const uniqueNames = new Set(names);
		assert.strictEqual(
			names.length,
			uniqueNames.size,
			"All server names must be unique",
		);
	});
});
