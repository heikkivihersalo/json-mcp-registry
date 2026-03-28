const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { validateRegistry, isSecret } = require("./validate");

// Import schema and current registry data
const schemaPath = path.resolve(__dirname, "../schema.json");
const registryPath = path.resolve(__dirname, "../v0/servers");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const currentRegistry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

test("isSecret detection basics", (_t) => {
	assert.strictEqual(
		isSecret("ghp_1234567890abcdef1234567890abcdef1234"),
		true,
		"Should detect GitHub PAT",
	);
	assert.strictEqual(
		isSecret("sk-1234567890abcdef1234567890abcdef"),
		true,
		"Should detect OpenAI-like key",
	);
	assert.strictEqual(
		// biome-ignore lint/suspicious/noTemplateCurlyInString: placeholder syntax
		isSecret("${GITHUB_TOKEN}"),
		false,
		"Should allow placeholders",
	);
	assert.strictEqual(
		isSecret("normal_string"),
		false,
		"Should allow normal strings",
	);
});

test("Current registry validation", (_t) => {
	const result = validateRegistry(currentRegistry, schema);
	if (!result.valid) {
		console.error("Validation Errors:", result.errors);
	}
	assert.strictEqual(result.valid, true, `Current registry should be valid.`);
});

test("Registry metadata consistency", (_t) => {
	const serverCount = currentRegistry.servers.length;
	const metadataCount = currentRegistry.metadata.count;
	assert.strictEqual(
		serverCount,
		metadataCount,
		`Metadata count (${metadataCount}) should match actual servers count (${serverCount})`,
	);
});

test("Unique server names", (_t) => {
	const names = currentRegistry.servers.map((s) => s.server.name);
	const uniqueNames = new Set(names);
	assert.strictEqual(
		names.length,
		uniqueNames.size,
		"All server names must be unique",
	);
});

test("Validation fails with env property", (_t) => {
	const data = {
		servers: [
			{
				server: {
					name: "org/leaker",
					description: "Leaky server",
					version: "1.0.0",
					packages: [
						{
							registryType: "npm",
							identifier: "leaker-pkg",
							transport: { type: "stdio" },
							environmentVariables: [
								{
									name: "BAD_KEY",
									value: "ghp_1234567890abcdef1234567890abcdef1234",
								},
							],
						},
					],
				},
			},
		],
		metadata: { count: 1 },
	};
	const result = validateRegistry(data, schema);
	assert.strictEqual(
		result.valid,
		false,
		"Should fail because of secret leak in env",
	);
	assert.ok(
		result.errors.some((e) => e.includes("Potential secret leak")),
		"Error should mention secret leak",
	);
});

test("Validation fails with secret in args", (_t) => {
	const data = {
		servers: [
			{
				server: {
					name: "org/leaker",
					description: "Leaky server",
					version: "1.0.0",
					packages: [
						{
							registryType: "npm",
							identifier: "leaker-pkg",
							transport: { type: "stdio" },
							packageArguments: [
								{
									type: "positional",
									value: "sk-1234567890abcdef1234567890abcdef",
								},
							],
						},
					],
				},
			},
		],
		metadata: { count: 1 },
	};
	const result = validateRegistry(data, schema);
	assert.strictEqual(result.valid, false, "Should fail with secret in args");
});

test("Validation fails with secret in URL", (_t) => {
	const data = {
		servers: [
			{
				server: {
					name: "org/leaker",
					description: "Leaky server",
					version: "1.0.0",
					remotes: [
						{
							type: "sse",
							url: "https://mcp.server.com/sse?key=ghp_1234567890abcdef1234567890abcdef1234",
						},
					],
				},
			},
		],
		metadata: { count: 1 },
	};
	const result = validateRegistry(data, schema);
	assert.strictEqual(result.valid, false, "Should fail with secret in URL");
});
