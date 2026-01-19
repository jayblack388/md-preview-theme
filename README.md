# Markdown Theme Sync

A lightweight VS Code/Cursor extension that automatically syncs markdown preview styling with your editor theme—light or dark—with instant hot-reload when you switch themes.

## Problem

Cursor's built-in markdown preview always shows white backgrounds with black text, regardless of your editor theme. Switching between light and dark editor themes doesn't update the preview, creating visual disconnect and poor readability.

## Solution

This extension:
- Detects when you change editor themes (light ↔ dark)
- Dynamically swaps preview CSS to match
- Hot-reloads instantly without manual refresh
- Works with Cursor's auto-theme-switching (light/dark mode pairs)

## Installation

```bash
# Build and install locally
yarn install
yarn package
cursor --install-extension markdown-theme-sync-0.1.0.vsix
```

## Usage

Just install and forget. The extension activates automatically when you open a markdown file and syncs the preview theme with your editor theme.

## Development

```bash
# Install dependencies
yarn install

# Compile TypeScript
yarn compile

# Watch for changes
yarn watch

# Package extension
yarn package
```

## License

MIT
