# Multi-Buffer Search

VS Code extension to edit multiple files in a single buffer. Search across your codebase and edit all matching locations simultaneously in a unified view.

## Features

- **Multi-file search**: Search for patterns across multiple files
- **Unified editing**: Edit all search results in a single buffer
- **Live updates**: Changes are reflected in real-time
- **Syntax highlighting**: Maintains proper syntax highlighting for each file segment
- **Batch operations**: Apply changes to multiple files at once

## Prerequisites

- Visual Studio Code 1.74.0 or higher
- Node.js 16.x or higher
- npm 8.x or higher

## Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd multi-buffer-search
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run compile
   ```

4. For development with watch mode:
   ```bash
   npm run watch
   ```

## Commands

The extension provides the following commands in the Command Palette (Ctrl/Cmd+Shift+P):

- **Multi-Buffer: Search** - Search for a pattern across multiple files
- **Multi-Buffer: Replace** - Find and replace across multiple files
- **Multi-Buffer: Apply Changes** - Apply all changes made in the multi-buffer to source files

## Keybindings

You can add custom keybindings in your `keybindings.json`:

```json
[
  {
    "key": "ctrl+shift+f",
    "command": "multi-buffer-search.search",
    "when": "editorTextFocus"
  },
  {
    "key": "ctrl+shift+h",
    "command": "multi-buffer-search.replace",
    "when": "editorTextFocus"
  },
  {
    "key": "ctrl+shift+s",
    "command": "multi-buffer-search.applyChanges",
    "when": "resourceScheme == multibuffer"
  }
]
```

## Usage Examples

### Basic Search

1. Open Command Palette (Ctrl/Cmd+Shift+P)
2. Run "Multi-Buffer: Search"
3. Enter your search pattern
4. Select files to include in the search
5. Edit results in the unified buffer
6. Apply changes with "Multi-Buffer: Apply Changes"

### Find and Replace

1. Run "Multi-Buffer: Replace"
2. Enter search pattern and replacement text
3. Preview changes in the multi-buffer
4. Apply when satisfied

### Multi-Buffer Format

The multi-buffer displays search results in a structured format:

```
// File: src/example.ts
// Lines: 10-15
function searchExample() {
  // Your matching code here
}

// File: src/another.ts
// Lines: 25-30
const result = searchExample();
```

## Development

### Running Tests

```bash
npm test
```

### Debugging

1. Open the project in VS Code
2. Press F5 to launch a new Extension Development Host
3. Test the extension in the new window

### Building for Production

```bash
npm run package
```

This creates a `.vsix` file that can be installed in VS Code.

## Contributing

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Use TypeScript for all source files
- Follow the existing code style (2 spaces, no tabs)
- Run `npm run lint` before committing
- Add tests for new features

### Reporting Issues

Please use the GitHub issue tracker to report bugs or request features. Include:

- VS Code version
- Extension version
- Steps to reproduce
- Expected vs actual behavior

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## Acknowledgments

- VS Code Extension API documentation
- The VS Code team for the excellent extension framework