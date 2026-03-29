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
	/\bghp_[a-zA-Z0-9]{36,}\b/i, // GitHub PAT
	/\bsk-[a-zA-Z0-9]{20,}\b/i, // Keys from various services (OpenAI etc.)
	/\bAIza[0-9A-Za-z-_]{35}\b/, // Google API key
	/\bxox[baprs]-[a-zA-Z0-9-]+\b/i, // Slack
	/\b[a-fA-F0-9]{32,}\b/, // Long hex string (generic secret)
	/\b[EIFV][0-9A-Z]{10,}\b/, // AWS common patterns
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
 * Checks for secrets in a package.
 *
 * @param {Object} pkg - The package to check.
 * @param {number} pkgIdx - The index of the package.
 * @param {string} serverName - The name of the server.
 * @param {string[]} errors - The array to add errors to.
 * @return {void}
 */
function checkPackageSecrets(pkg, pkgIdx, serverName, errors) {
	pkg.environmentVariables?.forEach((env) => {
		if (isSecret(env.value)) {
			errors.push(
				`Potential secret leak in server "${serverName}" package ${pkgIdx} env var "${env.name}".`,
			);
		}
	});

	pkg.packageArguments?.forEach((arg, argIdx) => {
		if (isSecret(arg.value)) {
			errors.push(
				`Potential secret leak in server "${serverName}" package ${pkgIdx} package argument ${argIdx}.`,
			);
		}
	});

	pkg.runtimeArguments?.forEach((arg, argIdx) => {
		if (isSecret(arg.value)) {
			errors.push(
				`Potential secret leak in server "${serverName}" package ${pkgIdx} runtime argument ${argIdx}.`,
			);
		}
	});
}

/**
 * Checks for secrets in a server.
 *
 * @param {Object} serverItem - The server item to check.
 * @param {string[]} errors - The array to add errors to.
 * @return {void}
 */
function checkServerSecrets(serverItem, errors) {
	const server = serverItem.server;
	const serverName = server.name;

	// Check top-level description/version for secrets (unlikely but safe)
	if (isSecret(server.description)) {
		errors.push(`Potential secret leak in description of "${serverName}".`);
	}
	if (isSecret(server.version)) {
		errors.push(`Potential secret leak in version of "${serverName}".`);
	}

	// Check packages
	server.packages?.forEach((pkg, pkgIdx) => {
		checkPackageSecrets(pkg, pkgIdx, serverName, errors);
	});

	// Check remotes
	server.remotes?.forEach((remote, remIdx) => {
		if (isSecret(remote.url)) {
			errors.push(
				`Potential secret leak in server "${serverName}" remote ${remIdx} URL.`,
			);
		}
	});
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

	data.servers?.forEach((serverItem) => {
		checkServerSecrets(serverItem, errors);
	});

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
