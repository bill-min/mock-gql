# MockGQL Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-23

### Added

- Initial release
- GraphQL request interception for both `fetch` and `XMLHttpRequest`
- DevTools panel with two tabs: Requests and Mock Rules
- Request list showing operation name, type (query/mutation), and timestamp
- Request detail view with query, variables, and response
- Copy response button for easy clipboard access
- Mock rules system with JSON response configuration
- Individual enable/disable toggle for each mock rule
- Global "Enable Mock" toggle to activate/deactivate all mocking
- Configurable response delay (in milliseconds) for simulating latency
- Edit and delete functionality for mock rules
- Persistent storage using `chrome.storage.local`
- Visual indicators for mocked requests (badge in request list)
- Dark theme UI matching Chrome DevTools aesthetic

### Technical

- Chrome Extension Manifest V3
- Service worker for background processing
- Content script bridge for extension-page communication
- Injected script for fetch/XHR monkey-patching

[1.0.0]: https://github.com/bill-min/mock-gql/releases/tag/v1.0.0
