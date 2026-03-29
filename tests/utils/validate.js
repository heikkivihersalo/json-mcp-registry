/**
 * External dependencies
 */
const fs = require("node:fs");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

/**
 * Hoisted heavy initializations
 */
const ajv = new Ajv({ strict: false });
addFormats(ajv);

/**
 * Hoisted Regex patterns so they are only compiled once
 */
const SECRET_PATTERNS = [
	// --- LLM Providers (Often configured in the MCP Host/Client) ---
	/\bsk-ant-api03-[a-zA-Z0-9\-_]{70,100}\b/, // Anthropic API Key (Claude)
	/\bsk-(?:proj|svc)-[a-zA-Z0-9\-_]{40,}\b/, // OpenAI Project & Service Keys (Newer format)

	// --- MCP Cloud & Remote Server Auth ---
	/\bmcp_sk_[a-zA-Z0-9]{32}\b/, // MCP-Cloud API Key (Remote SSE/HTTP MCP servers)

	// --- Knowledge Base & Issue Tracking (Official/Popular MCPs) ---
	/\bsecret_[a-zA-Z0-9]{43}\b/, // Notion Internal Integration Secret
	/\blin_api_[a-zA-Z0-9]{40}\b/, // Linear API Key

	// --- Code, Design, & File Systems ---
	/\bfigd_[a-zA-Z0-9\-_]{43}\b/, // Figma Personal Access Token
	/\bglpat-[a-zA-Z0-9\-_]{20}\b/, // GitLab Personal Access Token

	// --- Search & Agentic Tools ---
	/\btvly-[a-zA-Z0-9]{32}\b/, // Tavily API Key (Common for AI search agents)

	// --- Database Servers (Crucial for Postgres/MySQL MCPs) ---
	/(?:postgres|mysql|mongodb)(?:ql)?:\/\/[^:\/\s]+:([^@\/\s]+)@[^:\/\s]+/, // Database URIs with passwords
];

/**
 * Checks if a value is a secret.
 *
 * @param {string} value - The value to check.
 * @return {boolean} True if the value is a secret, false otherwise.
 */
function isSecret(value) {
	if (typeof value !== "string") return false;

	// Allow placeholders
	if (value.startsWith("${") && value.endsWith("}")) return false;

	return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Recursively scans an object for secrets.
 *
 * @param {any} node - The current node to scan.
 * @param {string} path - The path to the current node (e.g., "servers.0.server.name").
 * @param {string[]} errors - The array to add errors to.
 * @return {void}
 */
function scanForSecrets(node, path, errors) {
	if (node === null || node === undefined) return;

	if (typeof node === "string") {
		if (isSecret(node)) {
			errors.push(`Potential secret leak at "${path}".`);
		}
		return;
	}

	if (Array.isArray(node)) {
		node.forEach((item, idx) => {
			scanForSecrets(item, `${path}[${idx}]`, errors);
		});
		return;
	}

	if (typeof node === "object") {
		Object.entries(node).forEach(([key, value]) => {
			scanForSecrets(value, `${path}.${key}`, errors);
		});
	}
}

/**
 * Validates the registry.
 *
 * @param {Object} data - The registry data.
 * @param {Object} schema - The schema to validate against.
 * @return {Object} The validation result.
 */
function validateRegistry(data, schema) {
	const validate = ajv.compile(schema);
	const isValid = validate(data);

	const errors = [];
	if (!isValid) {
		errors.push(
			`JSON Schema validation failed: ${ajv.errorsText(validate.errors)}`,
		);
	}

	// Recursive secret scan across the entire registry structure.
	// This ensures secrets are caught in any field (URLs, descriptions, meta, headers, etc.)
	scanForSecrets(data, "root", errors);

	return {
		valid: errors.length === 0,
		errors,
	};
}

/**
 * Module export for testing
 */
if (typeof module !== "undefined" && module.exports) {
	module.exports = { validateRegistry, isSecret };
}

/**
 * RUNNER: When executed directly
 */
if (require.main === module) {
	try {
		const paths = require("./paths");
		const schema = JSON.parse(fs.readFileSync(paths.schema, "utf8"));
		const data = JSON.parse(fs.readFileSync(paths.registry, "utf8"));

		const result = validateRegistry(data, schema);

		if (!result.valid) {
			result.errors.forEach((err) => {
				console.error(`ERROR: ${err}`);
			});
			console.error("\nFATAL: Registry validation failed.");
			process.exit(1);
		}

		console.log(
			"Validation passed! The registry config is fully valid and clean of secrets.",
		);
	} catch (err) {
		console.error("Internal validation script error:", err.message);
		process.exit(1);
	}
}
