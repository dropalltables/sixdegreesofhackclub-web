# Six Degrees of Hack Club

A network visualization tool that maps connections between Hack Club Slack channels and finds the shortest path between any two channels.

## Features

### Network Graph Mode
- Interactive D3.js force-directed graph visualization
- Zoom and pan controls
- Search and highlight channels
- Find shortest paths between channels with visual highlighting
- Click nodes to select channels

### Simple Path Finder Mode
- Lightweight interface for finding channel connections
- No resource-intensive graph rendering
- Shows step-by-step paths with message links
- Fast and mobile-friendly

## Project Structure

```
sixdegreesofhackclub-web/
├── index.html          # Main network graph visualization
├── simple.html         # Lightweight path finder
├── vercel.json         # Vercel deployment configuration
├── css/
│   ├── style.css       # Styles for graph mode
│   └── simple.css      # Styles for simple mode
├── js/
│   ├── graph.js        # Graph visualization logic
│   └── simple.js       # Path finder logic
└── data/
    ├── channel-links.jsonl      # Channel connection data
    ├── channel-metadata.json    # Channel metadata
    └── channels-cache.json      # Cached channel data
```

## Usage

### Local Development

1. Clone the repository
2. Serve the files with any static file server
3. Open `index.html` in your browser

Example with Python:
```bash
python -m http.server 8000
```

### Deployment

This project is configured for Vercel deployment with clean URLs:

- `/` - Home page with startup modal
- `/graph` - Direct link to network graph
- `/simple` - Direct link to path finder

Deploy with:
```bash
vercel
```

## Data Format

### channel-links.jsonl
Each line contains a connection between two channels:
```json
{
  "from": "C0266FRGT",
  "to": "C08N0R86DMJ",
  "fromName": "announcements",
  "toName": "shipwrecked",
  "messageTs": "1761088071.264299",
  "messageDate": "2025-10-21T23:07:51.264Z",
  "messageLink": "https://hackclub.slack.com/archives/..."
}
```

## Technologies

- D3.js v7 - Network visualization
- Vanilla JavaScript - No framework dependencies
- CSS3 - Modern styling with backdrop filters

## Performance

- Graph mode: Resource-intensive, recommended for desktop
- Simple mode: Lightweight, works on all devices
- Data caching: 1 hour for data files, 1 year for static assets

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

This license applies to all code in this repository, including all historical commits.

Built for Hack Club
