let graphData = { nodes: [], links: [] };
let channelMap = new Map();
let linkMap = new Map();

// Load data
async function loadData() {
    try {
        const response = await fetch('data/channel-links.jsonl');
        const text = await response.text();
        const lines = text.trim().split('\n');

        const nodes = new Map();
        const links = [];

        for (const line of lines) {
            if (!line.trim()) continue;
            const conn = JSON.parse(line);

            // Skip private/archived channels (where name === id)
            if (conn.fromName === conn.from || conn.toName === conn.to) {
                continue;
            }

            // Add nodes
            if (!nodes.has(conn.from)) {
                nodes.set(conn.from, {
                    id: conn.from,
                    name: conn.fromName,
                    connections: 0
                });
                channelMap.set(conn.fromName.toLowerCase(), conn.from);
            }
            if (!nodes.has(conn.to)) {
                nodes.set(conn.to, {
                    id: conn.to,
                    name: conn.toName,
                    connections: 0
                });
                channelMap.set(conn.toName.toLowerCase(), conn.to);
            }

            // Add link
            links.push({
                source: conn.from,
                target: conn.to
            });

            // Store link info for path finding
            const linkKey = `${conn.from}->${conn.to}`;
            linkMap.set(linkKey, {
                messageLink: conn.messageLink,
                messageDate: conn.messageDate
            });

            nodes.get(conn.from).connections++;
            nodes.get(conn.to).connections++;
        }

        graphData.nodes = Array.from(nodes.values());
        graphData.links = links;

        // Populate channel list
        const simpleDatalist = document.getElementById('simple-channels');
        graphData.nodes
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(node => {
                const option = document.createElement('option');
                option.value = node.name;
                simpleDatalist.appendChild(option);
            });

        // Update stats
        document.getElementById('simple-node-count').textContent = `Channels: ${graphData.nodes.length}`;
        document.getElementById('simple-link-count').textContent = `Connections: ${graphData.links.length}`;

        document.getElementById('loading').style.display = 'none';
        document.getElementById('simple-mode').style.display = 'flex';

    } catch (error) {
        document.getElementById('loading').textContent = `Error loading data: ${error.message}`;
    }
}

// BFS pathfinding
function findPath(startId, endId) {
    if (startId === endId) return { path: [startId], links: [] };

    const queue = [[startId]];
    const visited = new Set([startId]);

    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];

        const outgoing = graphData.links.filter(l => {
            const sourceId = l.source.id || l.source;
            return sourceId === current;
        });

        for (const link of outgoing) {
            const nextId = link.target.id || link.target;

            if (nextId === endId) {
                const fullPath = [...path, endId];
                const pathLinks = [];

                // Get link info for each step
                for (let i = 0; i < fullPath.length - 1; i++) {
                    const linkKey = `${fullPath[i]}->${fullPath[i + 1]}`;
                    pathLinks.push(linkMap.get(linkKey));
                }

                return { path: fullPath, links: pathLinks };
            }

            if (!visited.has(nextId)) {
                visited.add(nextId);
                queue.push([...path, nextId]);
            }
        }
    }

    return null;
}

function displayPathWithLinks(pathData) {
    if (!pathData) return null;

    const { path, links } = pathData;
    let display = '';

    for (let i = 0; i < path.length; i++) {
        const nodeData = graphData.nodes.find(n => n.id === path[i]);
        display += `<div class="path-step">
            <div class="channel-name">#${nodeData.name}</div>`;

        if (i < links.length && links[i]) {
            display += `<a href="${links[i].messageLink}" target="_blank" class="message-link">View message →</a>`;
        }

        display += `</div>`;

        if (i < path.length - 1) {
            display += `<div class="path-arrow">↓</div>`;
        }
    }

    return display;
}

// Find path button
document.getElementById('simple-find').addEventListener('click', () => {
    const fromName = document.getElementById('simple-from').value.toLowerCase();
    const toName = document.getElementById('simple-to').value.toLowerCase();

    const fromId = channelMap.get(fromName);
    const toId = channelMap.get(toName);

    if (!fromId || !toId) {
        alert('Please enter valid channel names');
        return;
    }

    const pathData = findPath(fromId, toId);

    const resultDiv = document.getElementById('path-result');

    if (!pathData) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = '<h3>No Path Found</h3><p style="color: #999;">No connection exists between these channels.</p>';
        return;
    }

    const { path, links } = pathData;
    const pathDisplay = displayPathWithLinks(pathData);

    resultDiv.style.display = 'block';
    resultDiv.innerHTML = `
        <h3>Path Found: ${path.length - 1} hop(s)</h3>
        ${pathDisplay}
    `;
});

// Load data on page load
loadData();
