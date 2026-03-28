const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

function isSecret(value) {
    if (typeof value !== 'string') return false;
    // Allow placeholders
    if (value.startsWith('${') && value.endsWith('}')) return false;

    // Known common secret prefixes (case insensitive)
    const secretPatterns = [
        /\bghp_[a-zA-Z0-9]{36,}\b/i,           // GitHub PAT
        /\bsk-[a-zA-Z0-9]{20,}\b/i,            // Keys from various services (OpenAI etc.)
        /\bAIza[0-9A-Za-z-_]{35}\b/,           // Google API key
        /\bxox[baprs]-[a-zA-Z0-9-]+\b/i,       // Slack
        /\b[a-fA-F0-9]{32,}\b/,                // Long hex string (generic secret)
        /\b[EIFV][0-9A-Z]{10,}\b/              // AWS common patterns
    ];

    return secretPatterns.some(p => p.test(value));
}

function validateRegistry(data, schema) {
    const ajv = new Ajv({ strict: false });
    addFormats(ajv);

    const validate = ajv.compile(schema);
    const valid = validate(data);

    const errors = [];
    if (!valid) {
        errors.push(`JSON Schema validation failed: ${ajv.errorsText(validate.errors)}`);
    }

    // Custom secret detection
    for (const [serverName, server] of Object.entries(data.mcpServers || {})) {
        // Check top-level description/version for secrets (unlikely but safe)
        if (isSecret(server.description)) errors.push(`Potential secret leak in description of "${serverName}".`);
        if (isSecret(server.version)) errors.push(`Potential secret leak in version of "${serverName}".`);

        // Check packages
        if (server.packages) {
            server.packages.forEach((pkg, pkgIdx) => {
                // Check environmentVariables
                if (pkg.environmentVariables) {
                    pkg.environmentVariables.forEach(env => {
                        if (isSecret(env.value)) errors.push(`Potential secret leak in server "${serverName}" package ${pkgIdx} env var "${env.name}".`);
                    });
                }
                // Check packageArguments
                if (pkg.packageArguments) {
                    pkg.packageArguments.forEach((arg, argIdx) => {
                        if (isSecret(arg.value)) errors.push(`Potential secret leak in server "${serverName}" package ${pkgIdx} package argument ${argIdx}.`);
                    });
                }
                // Check runtimeArguments
                if (pkg.runtimeArguments) {
                    pkg.runtimeArguments.forEach((arg, argIdx) => {
                        if (isSecret(arg.value)) errors.push(`Potential secret leak in server "${serverName}" package ${pkgIdx} runtime argument ${argIdx}.`);
                    });
                }
            });
        }

        // Check remotes (URL substitution)
        if (server.remotes) {
            server.remotes.forEach((remote, remIdx) => {
                if (isSecret(remote.url)) errors.push(`Potential secret leak in server "${serverName}" remote ${remIdx} URL.`);
            });
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

// Module export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { validateRegistry, isSecret };
}

// RUNNER: When executed directly
if (require.main === module) {
    try {
        const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../schema.json'), 'utf8'));
        const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../v0/servers'), 'utf8'));

        const result = validateRegistry(data, schema);
        
        if (!result.valid) {
            result.errors.forEach(err => console.error(`ERROR: ${err}`));
            console.error("\nFATAL: Registry validation failed.");
            process.exit(1);
        }

        console.log("Validation passed! The registry config is fully valid and clean of secrets.");
    } catch (err) {
        console.error("Internal validation script error:", err.message);
        process.exit(1);
    }
}
