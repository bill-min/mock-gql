# MockGQL Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Conditional mock rules that only apply when the GraphQL variables match an optional JSON subset
- Support for multiple mock rules per operation, with variable-specific rules taking priority over generic rules

## [1.1.0] - 2025-01-27

### Added

- Network tab marker requests: Mocked GraphQL requests now appear in the browser's Network tab as canceled requests with descriptive URLs (e.g., `/api/graphql/__mockgql__/mocked/GetUser`). This makes it easier to see which requests were mocked when filtering by GraphQL endpoint patterns.

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
