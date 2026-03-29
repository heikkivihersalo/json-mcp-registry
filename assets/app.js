let allServers = [];

async function init() {
	try {
		const response = await fetch("./v0.1/servers");
		if (!response.ok) throw new Error("Failed to fetch registry");

		const data = await response.json();
		allServers = data.servers;

		// Update UI Stats
		document.getElementById("server-count").innerText =
			data.metadata.count || allServers.length;

		renderGrid(allServers);
	} catch (error) {
		console.error("Error loading registry:", error);
		document.getElementById("server-grid").innerHTML = `
            <div class="error-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <title>Error Icon</title>
                    <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>Failed to load the MCP registry endpoints. Ensure the static file exists at <code>v0.1/servers</code>.</p>
            </div>
        `;
	}
}

function renderGrid(servers) {
	const grid = document.getElementById("server-grid");
	grid.innerHTML = "";

	if (servers.length === 0) {
		grid.innerHTML = `
            <div class="empty-state">
                <p>No servers matched your search criteria.</p>
            </div>
        `;
		return;
	}

	servers.forEach((item, index) => {
		const srv = item.server;
		const card = document.createElement("div");
		card.className = "card";
		card.style.animationDelay = `${index * 0.05}s`;

		let capabilitiesHtml = "";

		if (srv.packages && srv.packages.length > 0) {
			const pkg = srv.packages[0];
			capabilitiesHtml = `
                <div class="badge-row">
                    <span class="badge package-badge">📦 ${pkg.registryType}</span>
                    <span class="code-snippet">npx ${pkg.identifier}</span>
                </div>
            `;
		} else if (srv.remotes && srv.remotes.length > 0) {
			const rem = srv.remotes[0];
			capabilitiesHtml = `
                <div class="badge-row">
                    <span class="badge remote-badge">🌐 Remote HTTP</span>
                    <span class="code-snippet">${rem.url}</span>
                </div>
            `;
		}

		card.innerHTML = `
            <div class="card-header">
                <h2 class="card-title">${srv.name.split("/").pop() || srv.name}</h2>
                <span class="version-badge">v${srv.version}</span>
            </div>
            <div class="card-namespace">${srv.name}</div>
            <p class="card-desc">${srv.description}</p>
            
            <div class="card-footer">
                ${capabilitiesHtml}
            </div>
        `;
		grid.appendChild(card);
	});
}

// Search logic
const searchInput = document.getElementById("search-input");
searchInput.addEventListener("input", (e) => {
	const query = e.target.value.toLowerCase();
	const filtered = allServers.filter((item) => {
		const srv = item.server;
		const matchName = srv.name.toLowerCase().includes(query);
		const matchDesc = srv.description
			? srv.description.toLowerCase().includes(query)
			: false;

		let matchPkg = false;
		if (srv.packages?.[0]?.identifier) {
			matchPkg = srv.packages[0].identifier.toLowerCase().includes(query);
		}

		return matchName || matchDesc || matchPkg;
	});
	renderGrid(filtered);
});

document.addEventListener("DOMContentLoaded", init);
