let graphData = { nodes: [], links: [] };
let simulation;
let svg, g, link, node;
let channelMap = new Map();
let renderGraphMode = true;
let linkMap = new Map(); // Store links with message info
let adjacencyList = new Map(); // Adjacency list for faster pathfinding
let currentTransform = d3.zoomIdentity; // Track zoom level for LOD
let searchTimeout = null; // Debounce search

// Startup modal handler
document.getElementById('start-btn').addEventListener('click', () => {
    renderGraphMode = document.getElementById('render-toggle').checked;

    if (!renderGraphMode) {
        // Redirect to simple mode
        window.location.href = 'simple.html';
        return;
    }

    document.getElementById('startup-modal').style.display = 'none';
    document.getElementById('loading').style.display = 'block';
    loadData();
});

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
            const linkData = {
                source: conn.from,
                target: conn.to,
                messageLink: conn.messageLink,
                messageDate: conn.messageDate
            };
            links.push(linkData);

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

        // Build adjacency list for optimized pathfinding
        for (const link of links) {
            const sourceId = link.source;
            if (!adjacencyList.has(sourceId)) {
                adjacencyList.set(sourceId, []);
            }
            adjacencyList.get(sourceId).push(link.target);
        }

        document.getElementById('loading').style.display = 'none';

        // Populate channel list for graph mode
        const datalist = document.getElementById('channels');
        graphData.nodes
            .sort((a, b) => a.name.localeCompare(b.name))
            .forEach(node => {
                const option = document.createElement('option');
                option.value = node.name;
                datalist.appendChild(option);
            });

        // Update stats
        document.getElementById('nodeCount').textContent = `Nodes: ${graphData.nodes.length}`;
        document.getElementById('linkCount').textContent = `Links: ${graphData.links.length}`;

        document.getElementById('controls').style.display = 'block';
        initGraph();
        setupGraphMode();
    } catch (error) {
        document.getElementById('loading').textContent = `Error loading data: ${error.message}`;
    }
}

function initGraph() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);

    g = svg.append('g');

    // Zoom behavior with LOD optimization
    const zoom = d3.zoom()
        .scaleExtent([0.1, 10])
        .on('zoom', (event) => {
            currentTransform = event.transform;
            g.attr('transform', event.transform);
            updateLabelVisibility(event.transform.k);
        });

    svg.call(zoom);

    // Create simulation with performance optimizations
    simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(20))
        .alphaDecay(0.02) // Faster convergence (default: 0.0228)
        .velocityDecay(0.4) // More damping for stability (default: 0.4)
        .alphaMin(0.001); // Stop simulation earlier (default: 0.001)

    // Create links
    link = g.append('g')
        .selectAll('line')
        .data(graphData.links)
        .join('line')
        .attr('class', 'link');

    // Create nodes
    const nodeGroup = g.append('g')
        .selectAll('g')
        .data(graphData.nodes)
        .join('g')
        .attr('class', 'node')
        .call(drag(simulation));

    nodeGroup.append('circle')
        .attr('r', d => Math.max(5, Math.min(15, d.connections)))
        .on('mouseover', showTooltip)
        .on('mouseout', hideTooltip)
        .on('click', (event, d) => {
            document.getElementById('fromChannel').value = d.name;
        });

    nodeGroup.append('text')
        .text(d => d.name)
        .attr('dy', 25)
        .attr('class', 'node-label');

    node = nodeGroup;

    // Initialize label visibility based on zoom level
    updateLabelVisibility(1);

    // Optimized tick function - runs only when simulation is active
    let tickCount = 0;
    simulation.on('tick', () => {
        tickCount++;
        // Only update every frame (no throttling needed as tick is already optimized)
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('transform', d => `translate(${d.x},${d.y})`);

        // Log progress every 100 ticks
        if (tickCount % 100 === 0) {
            console.log(`Simulation progress: alpha = ${simulation.alpha().toFixed(4)}`);
        }
    });

    // Log when simulation stops
    simulation.on('end', () => {
        console.log(`Simulation complete after ${tickCount} ticks`);
    });
}

// Level of Detail: Hide labels when zoomed out
function updateLabelVisibility(zoomLevel) {
    const labels = g.selectAll('.node-label');

    // Show labels only when zoomed in past threshold
    if (zoomLevel < 0.5) {
        // Very zoomed out - hide all labels
        labels.style('display', 'none');
    } else if (zoomLevel < 1.5) {
        // Medium zoom - show labels for highly connected nodes only
        labels.style('display', d => d.connections > 20 ? 'block' : 'none');
    } else {
        // Zoomed in - show all labels
        labels.style('display', 'block');
    }
}

function drag(simulation) {
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
}

function showTooltip(event, d) {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.display = 'block';
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY + 10) + 'px';
    tooltip.innerHTML = `
        <div class="channel-name">#${d.name}</div>
        <div class="connections">${d.connections} connections</div>
    `;
}

function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
}

// Optimized search function
function performSearch(searchTerm) {
    node.classed('highlighted', d => d.name.toLowerCase().includes(searchTerm));

    if (searchTerm) {
        node.style('opacity', d => d.name.toLowerCase().includes(searchTerm) ? 1 : 0.2);
        link.style('opacity', 0.1);
    } else {
        node.style('opacity', 1);
        link.style('opacity', 1);
    }
}

// Graph mode specific functions
function setupGraphMode() {
    // Search functionality with debouncing for better performance
    document.getElementById('search').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();

        // Clear existing timeout
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }

        // Debounce search by 150ms
        searchTimeout = setTimeout(() => {
            performSearch(searchTerm);
        }, 150);
    });

    // Find path button
    document.getElementById('findPath').addEventListener('click', () => {
        const fromName = document.getElementById('fromChannel').value.toLowerCase();
        const toName = document.getElementById('toChannel').value.toLowerCase();

        const fromId = channelMap.get(fromName);
        const toId = channelMap.get(toName);

        if (!fromId || !toId) {
            alert('Please enter valid channel names');
            return;
        }

        const pathData = findPath(fromId, toId);

        if (!pathData) {
            alert('No path found between these channels');
            return;
        }

        const { path, links } = pathData;

        // Highlight path
        clearHighlights();

        node.classed('highlighted', d => path.includes(d.id));

        link.classed('highlighted', d => {
            for (let i = 0; i < path.length - 1; i++) {
                if (d.source.id === path[i] && d.target.id === path[i + 1]) {
                    return true;
                }
            }
            return false;
        });

        node.style('opacity', d => path.includes(d.id) ? 1 : 0.2);
        link.style('opacity', d => {
            for (let i = 0; i < path.length - 1; i++) {
                if (d.source.id === path[i] && d.target.id === path[i + 1]) {
                    return 1;
                }
            }
            return 0.1;
        });

        // Show path with message links
        const pathDisplay = displayPathWithLinks(pathData);
        alert(`Path found with ${path.length - 1} hop(s)! Check console for details.`);
        console.log('Path found:');
        console.log(pathDisplay);
    });

    // Clear path button
    document.getElementById('clearPath').addEventListener('click', () => {
        clearHighlights();
        document.getElementById('fromChannel').value = '';
        document.getElementById('toChannel').value = '';
    });
}

function clearHighlights() {
    node.classed('highlighted', false);
    link.classed('highlighted', false);
    node.style('opacity', 1);
    link.style('opacity', 1);
}

// Optimized BFS pathfinding using adjacency list
function findPath(startId, endId) {
    if (startId === endId) return { path: [startId], links: [] };

    const queue = [[startId]];
    const visited = new Set([startId]);

    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];

        // Use adjacency list for O(1) lookup instead of O(n) filtering
        const neighbors = adjacencyList.get(current) || [];

        for (const nextId of neighbors) {
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
