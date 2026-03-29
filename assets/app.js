let allServers = [];
const gridElement = document.getElementById("server-grid");

function getRepositoryInfo(name) {
	if (name.startsWith("io.github.")) {
		const slug = name.substring("io.github.".length);
		return { url: `https://github.com/${slug}`, display: slug };
	}

	const parts = name.split("/");
	const namespace = parts[0];

	if (namespace.includes(".")) {
		const domainParts = namespace.split(".");
		domainParts.reverse();
		const domain = domainParts.join(".");
		return { url: `https://${domain}`, display: domain };
	}

	return { url: "#", display: name };
}

async function init() {
	// Attempt to load the example configuration
	loadExampleConfig();

	try {
		const response = await fetch("./v0.1/servers");
		if (!response.ok) throw new Error("Failed to fetch registry");

		const data = await response.json();
		allServers = data.servers;

		document.getElementById("server-count").innerText =
			data.metadata.count || allServers.length;
		renderGrid(allServers);
	} catch (error) {
		console.error("Error loading registry:", error);
		gridElement.innerHTML = `
            <div class="error-state">
                <svg width="48" height="48"><use href="#icon-error"></use></svg>
                <p>Failed to load the MCP registry endpoints. Ensure the static file exists at <code>v0.1/servers</code>.</p>
            </div>
        `;
	}
}

async function loadExampleConfig() {
	try {
		const response = await fetch("./mcp.example.json");
		if (!response.ok) return;

		const text = await response.text();
		const codeEl = document.getElementById("example-config-code");
		if (codeEl) {
			codeEl.textContent = text.trim();
		}
	} catch (error) {
		console.error("Error loading example config:", error);
	}
}

function renderGrid(servers) {
	if (servers.length === 0) {
		gridElement.innerHTML = `
            <div class="empty-state">
                <p>No servers matched your search criteria.</p>
            </div>
        `;
		return;
	}

	// Build the DOM string once to prevent layout thrashing
	const htmlString = servers
		.map((item, index) => {
			const srv = item.server;
			const repoInfo = getRepositoryInfo(srv.name);
			let capabilitiesHtml = "";

			if (srv.packages && srv.packages.length > 0) {
				const pkg = srv.packages[0];
				capabilitiesHtml = `
                <div class="badge-row">
                    <span class="badge package-badge">📦 ${pkg.registryType}</span>
                    <button class="code-snippet" title="Click to copy">npm i -g ${pkg.identifier}</button>
                </div>
            `;
			} else if (srv.remotes && srv.remotes.length > 0) {
				const rem = srv.remotes[0];
				capabilitiesHtml = `
                <div class="badge-row">
                    <span class="badge remote-badge">🌐 Remote HTTP</span>
                    <button class="code-snippet" title="Click to copy">${rem.url}</button>
                </div>
            `;
			}

			return `
            <div class="card" style="animation-delay: ${index * 0.05}s">
                <div class="card-header">
                    <h2 class="card-title">${srv.name.split("/").pop() || srv.name}</h2>
                    <span class="version-badge">v${srv.version}</span>
                </div>
                <a href="${repoInfo.url}" target="_blank" rel="noopener noreferrer" class="card-namespace">
                    <svg width="14" height="14"><use href="#icon-external"></use></svg>
                    ${repoInfo.display}
                </a>
                <p class="card-desc">${srv.description}</p>
                <div class="card-footer">
                    ${capabilitiesHtml}
                </div>
            </div>
        `;
		})
		.join("");

	gridElement.innerHTML = htmlString;
}

// Global Event Delegation for copying snippets
gridElement.addEventListener("click", async (e) => {
	const snippet = e.target.closest(".code-snippet");
	if (!snippet) return;

	const text = snippet.innerText;
	if (text === "Copied!") return;

	try {
		await navigator.clipboard.writeText(text);
		snippet.innerText = "Copied!";
		snippet.classList.add("copied");

		setTimeout(() => {
			snippet.innerText = text;
			snippet.classList.remove("copied");
		}, 1500);
	} catch (err) {
		console.error("Failed to copy:", err);
	}
});

// Wire up the dynamic CSS hover effect
gridElement.addEventListener("mousemove", (e) => {
	for (const card of document.querySelectorAll(".card")) {
		const rect = card.getBoundingClientRect(),
			x = e.clientX - rect.left,
			y = e.clientY - rect.top;

		card.style.setProperty("--mouse-x", `${x}px`);
		card.style.setProperty("--mouse-y", `${y}px`);
	}
});

// Search logic
document.getElementById("search-input").addEventListener("input", (e) => {
	const query = e.target.value.toLowerCase();
	const filtered = allServers.filter((item) => {
		const srv = item.server;
		const matchName = srv.name.toLowerCase().includes(query);
		const matchDesc = srv.description
			? srv.description.toLowerCase().includes(query)
			: false;
		const matchPkg =
			srv.packages?.[0]?.identifier?.toLowerCase().includes(query) || false;

		return matchName || matchDesc || matchPkg;
	});
	renderGrid(filtered);
});

document.addEventListener("DOMContentLoaded", init);
