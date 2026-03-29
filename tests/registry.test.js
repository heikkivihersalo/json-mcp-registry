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
const { validateRegistry, isSecret } = require("./utils/validate");

/**
 * Load static files once
 */
const schema = JSON.parse(fs.readFileSync(paths.schema, "utf8"));
const currentRegistry = JSON.parse(fs.readFileSync(paths.registry, "utf8"));

/**
 * Factory helper to generate minimal mock registries for testing validation.
 * Eliminates boilerplate duplication in test data.
 *
 * @param {Object} serverOverrides - Overrides for the server object.
 * @return {Object} The mock registry.
 */
function createMockRegistry(serverOverrides) {
	return {
		metadata: { count: 1 },
		servers: [
			{
				server: {
					name: "org/leaker",
					description: "Leaky server",
					version: "1.0.0",
					...serverOverrides,
				},
			},
		],
	};
}

describe("Secret Detection Unit Tests (isSecret)", () => {
	it("should detect GitHub PAT", () => {
		assert.strictEqual(
			isSecret("ghp_1234567890abcdef1234567890abcdef1234"),
			true,
		);
	});

	it("should detect OpenAI-like key", () => {
		assert.strictEqual(isSecret("sk-1234567890abcdef1234567890abcdef"), true);
	});

	it("should allow placeholders", () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: placeholder syntax
		assert.strictEqual(isSecret("${GITHUB_TOKEN}"), false);
	});

	it("should allow normal strings", () => {
		assert.strictEqual(isSecret("normal_string"), false);
	});
});

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

describe("Registry Validation Security Rules", () => {
	it("fails when a secret is leaked in environmentVariables", () => {
		const data = createMockRegistry({
			packages: [
				{
					registryType: "npm",
					identifier: "leaker-pkg",
					environmentVariables: [
						{
							name: "BAD_KEY",
							value: "ghp_1234567890abcdef1234567890abcdef1234",
						},
					],
				},
			],
		});

		const result = validateRegistry(data, schema);

		assert.strictEqual(result.valid, false);
		assert.ok(
			result.errors.some((e) => e.includes("Potential secret leak")),
			"Error must mention secret leak",
		);
	});

	it("fails when a secret is leaked in packageArguments", () => {
		const data = createMockRegistry({
			packages: [
				{
					registryType: "npm",
					identifier: "leaker-pkg",
					packageArguments: [
						{
							type: "positional",
							value: "sk-1234567890abcdef1234567890abcdef",
						},
					],
				},
			],
		});

		const result = validateRegistry(data, schema);

		assert.strictEqual(result.valid, false);
		assert.ok(
			result.errors.some((e) => e.includes("Potential secret leak")),
			"Error must mention secret leak",
		);
	});

	it("fails when a secret is leaked in a remote URL", () => {
		const data = createMockRegistry({
			remotes: [
				{
					type: "sse",
					url: "https://mcp.server.com/sse?key=ghp_1234567890abcdef1234567890abcdef1234",
				},
			],
		});
		const result = validateRegistry(data, schema);

		assert.strictEqual(result.valid, false);
		assert.ok(
			result.errors.some((e) => e.includes("Potential secret leak")),
			"Error must mention secret leak",
		);
	});
});
