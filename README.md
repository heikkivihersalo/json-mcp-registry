# JSON MCP Registry

A simple Model Context Protocol (MCP) server registry. This acts as a central whitelist configuration for your organization's approved remote and locally-hosted MCP servers.

## The Routing Quirk: `/v0/servers`
Enterprise clients like GitHub Copilot in VS Code or JetBrains adhere to the official open-source MCP Registry specification. They don't just read the exact URL you paste. They treat your URL as a **Base URL** and will automatically append the official endpoint path to it: `/v0/servers`.

So, if you put `https://my-company.com/registry` into your GitHub settings, the IDE will actually make a network request to:
`https://my-company.com/registry/v0/servers`

To make a simple JSON file work, you just need to mimic that API folder structure on your static host. The actual JSON data is stored at `v0/servers` (with no `.json` extension).

## Hosting Instructions

### 1. The "Raw GitHub" Method (Easiest)
You can host this directly in a private or public GitHub repository without even setting up GitHub Pages:
1. Push this repository to GitHub.
2. The folder structure `v0/servers` is already set up.
3. Get the raw URL for the root of your repo. It will look something like: `https://raw.githubusercontent.com/<OWNER>/<REPO>/main`
4. Use this URL as your Base URL.

### 2. The GitHub Pages / S3 Method
If you prefer traditional static hosting (GitHub Pages, AWS S3, Cloudflare Pages):
1. Deploy this workspace. The folder `v0` and file `servers` are already correctly positioned.
2. Ensure your static host serves that file with an `application/json` content type. 
3. Your Base URL will be your domain (e.g., `https://<YOUR-PROJECT>.pages.dev`).

## Plugging it into GitHub
Once your file is live at that path, you just wire it up in your organization's settings:
1. Go to your GitHub Enterprise or Organization settings.
2. Navigate to **Policies -> Copilot -> Policies** (or the AI Controls tab).
3. Find the **MCP** section and enable it.
4. Paste your **Base URL** into the **MCP Registry URL** field.
5. Set the enforcement mode to "Registry only".

## Validation
This repository includes a validation step to ensure your `v0/servers` file is always properly formatted.
The GitHub action (`.github/workflows/validate.yml`) will automatically run on Pull Requests and Pushes to the `main` branch.

To test locally:
```bash
npm install

# 1. Run all tests (schema + secret detection)
npm test

# 2. Simulate how a client converts the registry to mcp.json
npm run test:client

# 3. Test a hosted registry URL (once deployed)
npm run test:hosted -- https://raw.githubusercontent.com/<user>/<repo>/main/v0/servers
```

## Structure of `v0/servers`
```json
{
  "servers": [
    {
      "server": {
        "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
        "name": "io.github.namespace/server-name",
        "description": "Clear human-readable explanation...",
        "version": "1.0.0",
        "packages": [
          {
            "registryType": "npm",
            "identifier": "package-name",
            "transport": { "type": "stdio" }
          }
        ]
      },
    }
  ],
  "metadata": {
    "nextCursor": null,
    "count": 1
  }
}
```
