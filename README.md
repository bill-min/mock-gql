# MockGQL

A Chrome DevTools extension to log and mock GraphQL requests.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)

## Features

- **Request Logging** - Intercepts all GraphQL requests (fetch and XHR) and displays them in a dedicated DevTools panel
- **Request Details** - View operation name, type (query/mutation), query, variables, and response for each request
- **Mocking** - Create mock rules to return custom responses for specific operations
- **Individual Rule Control** - Enable/disable individual mock rules with toggles
- **Response Delay** - Add artificial latency to mocked responses for testing loading states
- **Persistent Storage** - Mock rules are saved and persist across browser sessions

## Installation

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/bill-min/mock-gql.git
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in the top right)

4. Click **Load unpacked** and select the `mock-gql` directory

5. The extension is now installed. Open DevTools on any page and look for the **MockGQL** tab.

## Usage

### Viewing Requests

1. Open any website that makes GraphQL requests
2. Open Chrome DevTools (F12 or Cmd+Option+I)
3. Navigate to the **MockGQL** tab
4. GraphQL requests will appear in the list as they are made
5. Click on a request to view its details (query, variables, response)

### Creating Mock Rules

1. Click on a request in the list
2. Click **Create Mock Rule** to pre-fill the form with the operation name and response
3. Modify the response JSON as needed
4. Optionally set a delay (in milliseconds) to simulate network latency
5. Click **Add Rule**

### Managing Mock Rules

- **Enable Mock** toggle (top right) - Master switch to enable/disable all mocking
- **Individual toggles** - Enable/disable specific rules without deleting them
- **Edit** - Modify an existing rule's response or delay
- **Delete** - Remove a rule entirely

### Tips

- The operation name must match exactly (case-sensitive)
- Mock rules persist in Chrome storage, so they survive browser restarts
- Use the delay feature to test loading states and race conditions
- Disabled rules appear dimmed but are preserved for later use

## Architecture

```
mock-gql/
├── manifest.json           # Extension manifest (Manifest V3)
├── devtools.html           # DevTools entry point
├── devtools.js             # Creates the DevTools panel
├── background/
│   └── service-worker.js   # Background service worker
├── content/
│   ├── content.js          # Content script (bridge)
│   └── injected.js         # Script injected into page context
├── panel/
│   ├── panel.html          # DevTools panel UI
│   ├── panel.js            # Panel logic
│   └── panel.css           # Styling
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## How It Works

1. **Injected Script** (`injected.js`) - Runs in the page context and monkey-patches `fetch` and `XMLHttpRequest` to intercept GraphQL requests
2. **Content Script** (`content.js`) - Acts as a bridge between the page and the extension
3. **Service Worker** (`service-worker.js`) - Coordinates messages and stores request data per tab
4. **DevTools Panel** (`panel/`) - Displays captured requests and manages mock rules

## Supported GraphQL Endpoints

The extension detects GraphQL endpoints by checking if the URL pathname contains:
- `/graphql`
- `/gql`

## Privacy

MockGQL does not collect, transmit, or share any personal data. All data is stored locally in your browser. See our [Privacy Policy](PRIVACY.md) for details.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
