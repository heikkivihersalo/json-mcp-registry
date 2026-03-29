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
	it("should detect Anthropic API Key", () => {
		assert.strictEqual(
			isSecret(
				"sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			),
			true,
		);
	});

	it("should detect OpenAI Project Key", () => {
		assert.strictEqual(
			isSecret("sk-proj-1234567890abcdef1234567890abcdef1234567890"),
			true,
		);
	});

	it("should detect Database URI with password", () => {
		assert.strictEqual(
			isSecret("postgres://user:secretPassword@localhost:5432/mcp"),
			true,
		);
	});

	it("should detect platform tokens (Notion, Figma, GitLab, etc.)", () => {
		assert.strictEqual(
			isSecret("secret_1234567890abcdef1234567890abcdef12345678901"),
			true,
		);
		assert.strictEqual(
			isSecret("figd_1234567890abcdef1234567890abcdef12345678901"),
			true,
		);
		assert.strictEqual(isSecret("glpat-1234567890abcdef1234"), true);
	});

	it("should allow placeholders", () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: placeholder syntax
		assert.strictEqual(isSecret("${GITHUB_TOKEN}"), false);
	});

	it("should allow normal strings", () => {
		assert.strictEqual(isSecret("normal_string"), false);
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
							name: "DB_URL",
							value:
								"mongodb://admin:mcp_sk_1234567890abcdef1234567890abcdef@atlas.com",
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

	it("fails when a secret is leaked in complex packageArguments (embedded)", () => {
		const data = createMockRegistry({
			packages: [
				{
					registryType: "npm",
					identifier: "leaker-pkg",
					packageArguments: [
						{
							type: "positional",
							value: "--api-key=mcp_sk_1234567890abcdef1234567890abcdef",
						},
						{
							type: "positional",
							value: "--config=/path/to/conf",
						},
					],
				},
			],
		});

		const result = validateRegistry(data, schema);

		assert.strictEqual(result.valid, false);
		assert.ok(
			result.errors.some(
				(e) =>
					e.includes("Potential secret leak") &&
					e.includes("packageArguments[0]"),
			),
			"Error must catch embedded secret in arguments.",
		);
	});

	it("fails when a secret is leaked in a remote URL", () => {
		const data = createMockRegistry({
			remotes: [
				{
					type: "sse",
					url: "https://mcp.server.com/sse?key=tvly-1234567890abcdef1234567890abcdef",
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

	it("fails when a secret is leaked in a package transport URL", () => {
		const data = createMockRegistry({
			packages: [
				{
					registryType: "npm",
					identifier: "leaker-pkg",
					transport: {
						type: "sse",
						url: "https://mcp.server.com/sse?key=sk-proj-1234567890abcdef1234567890abcdef1234567890",
					},
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

	it("fails when a secret is leaked in transport headers", () => {
		const data = createMockRegistry({
			remotes: [
				{
					type: "http",
					url: "https://mcp.figma.com/mcp",
					headers: [
						{
							name: "Authorization",
							value: "Bearer figd_1234567890abcdef1234567890abcdef12345678901",
						},
					],
				},
			],
		});
		const result = validateRegistry(data, schema);

		assert.strictEqual(result.valid, false);
		assert.ok(result.errors.some((e) => e.includes("Potential secret leak")));
	});

	it("fails when a secret is leaked in websiteUrl", () => {
		const data = createMockRegistry({
			websiteUrl:
				"https://example.com/?token=sk-ant-api03-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		});
		const result = validateRegistry(data, schema);

		assert.strictEqual(result.valid, false);
		assert.ok(result.errors.some((e) => e.includes("Potential secret leak")));
	});

	it("fails when a secret is leaked in extension metadata (_meta)", () => {
		const data = createMockRegistry({
			_meta: {
				"custom.vendor/key": "mcp_sk_1234567890abcdef1234567890abcdef",
			},
		});
		const result = validateRegistry(data, schema);

		assert.strictEqual(result.valid, false);
		assert.ok(result.errors.some((e) => e.includes("Potential secret leak")));
	});
});
