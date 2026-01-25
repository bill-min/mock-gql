# Privacy Policy for MockGQL

**Last Updated:** January 23, 2025

## Overview

MockGQL is a browser extension that helps developers debug and mock GraphQL requests. Your privacy is important to us. This policy explains what data the extension accesses and how it is handled.

## Data Collection

**MockGQL does not collect, transmit, or share any personal data.**

### What the extension accesses:

- **GraphQL network requests**: The extension intercepts GraphQL requests (to URLs containing `/graphql` or `/gql`) to display query details in the DevTools panel.
- **User-configured mock rules**: Mock rules you create are stored locally in your browser.

### What is stored locally:

- Mock rules (operation names and mock responses)
- Mocking enabled/disabled preference

All data is stored using `chrome.storage.local` and never leaves your browser.

## Data Sharing

MockGQL does not:
- Collect personal information
- Track browsing history
- Send data to external servers
- Use analytics or tracking services
- Share any data with third parties

## Permissions

The extension requires the following permissions:

- **Host permissions (`<all_urls>`)**: Required to intercept GraphQL requests on any website you're developing or debugging.
- **Storage**: Required to save your mock rules locally.

## Open Source

MockGQL is open source. You can review the complete source code at:
https://github.com/bill-min/mock-gql

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last Updated" date above.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository:
https://github.com/bill-min/mock-gql/issues
