const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { validateRegistry, isSecret } = require('./validate');

// Import schema and current registry data
const schemaPath = path.resolve(__dirname, '../schema.json');
const registryPath = path.resolve(__dirname, '../v0/servers');

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const currentRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

test('isSecret detection basics', (t) => {
    assert.strictEqual(isSecret('ghp_1234567890abcdef1234567890abcdef1234'), true, 'Should detect GitHub PAT');
    assert.strictEqual(isSecret('sk-1234567890abcdef1234567890abcdef'), true, 'Should detect OpenAI-like key');
    assert.strictEqual(isSecret('${GITHUB_TOKEN}'), false, 'Should allow placeholders');
    assert.strictEqual(isSecret('normal_string'), false, 'Should allow normal strings');
});

test('Current registry validation', (t) => {
    const result = validateRegistry(currentRegistry, schema);
    if (!result.valid) {
        console.error('Validation Errors:', result.errors);
    }
    assert.strictEqual(result.valid, true, `Current registry should be valid.`);
});

test('Validation fails with env property', (t) => {
    const data = {
        mcpServers: {
            "leaker": {
                "name": "org/leaker",
                "description": "Leaky server",
                "version": "1.0.0",
                "packages": [
                    {
                        "registryType": "npm",
                        "identifier": "leaker-pkg",
                        "transport": { "type": "stdio" },
                        "environmentVariables": [
                            {
                                "name": "BAD_KEY",
                                "value": "ghp_1234567890abcdef1234567890abcdef1234"
                            }
                        ]
                    }
                ]
            }
        }
    };
    const result = validateRegistry(data, schema);
    assert.strictEqual(result.valid, false, 'Should fail because of secret leak in env');
    assert.ok(result.errors.some(e => e.includes('Potential secret leak')), 'Error should mention secret leak');
});

test('Validation fails with secret in args', (t) => {
    const data = {
        mcpServers: {
            "leaker": {
                "name": "org/leaker",
                "description": "Leaky server",
                "version": "1.0.0",
                "packages": [
                    {
                        "registryType": "npm",
                        "identifier": "leaker-pkg",
                        "transport": { "type": "stdio" },
                        "packageArguments": [
                            { "type": "positional", "value": "sk-1234567890abcdef1234567890abcdef" }
                        ]
                    }
                ]
            }
        }
    };
    const result = validateRegistry(data, schema);
    assert.strictEqual(result.valid, false, 'Should fail with secret in args');
});

test('Validation fails with secret in URL', (t) => {
    const data = {
        mcpServers: {
            "leaker": {
                "name": "org/leaker",
                "description": "Leaky server",
                "version": "1.0.0",
                "remotes": [
                    {
                        "type": "sse",
                        "url": "https://mcp.server.com/sse?key=ghp_1234567890abcdef1234567890abcdef1234"
                    }
                ]
            }
        }
    };
    const result = validateRegistry(data, schema);
    assert.strictEqual(result.valid, false, 'Should fail with secret in URL');
});
