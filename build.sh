#!/bin/bash

# Build script for VS Code Omni-Buffer extension
# Usage: ./build.sh [option]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Install dependencies
install_deps() {
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        print_status "Installing dependencies..."
        npm install
        print_success "Dependencies installed"
    else
        print_status "Dependencies are up to date"
    fi
}

# Clean build output
clean() {
    print_status "Cleaning build output..."
    rm -rf out/
    print_success "Build output cleaned"
}

# Compile TypeScript
compile() {
    print_status "Compiling TypeScript..."
    npm run compile
    print_success "Compilation completed"
}

# Run linter
lint() {
    print_status "Running linter..."
    npm run lint
    print_success "Linting completed"
}

# Run tests
test() {
    print_status "Running tests..."
    npm run test
    print_success "Tests completed"
}

# Watch mode
watch() {
    print_status "Starting watch mode..."
    print_warning "Press Ctrl+C to stop watching"
    npm run watch
}

# Show help
show_help() {
    echo "VS Code Omni-Buffer Extension Build Script"
    echo ""
    echo "Usage: ./build.sh [OPTION]"
    echo ""
    echo "Options:"
    echo "  (no option)  Default build: install deps + compile"
    echo "  clean        Remove build output directory"
    echo "  watch        Start watch mode for continuous compilation"
    echo "  lint         Run ESLint on source files"
    echo "  test         Run tests (includes compile + lint)"
    echo "  full         Full build: lint + compile + test"
    echo "  dev [path]   Launch VS Code Extension Development Host (optional workspace path)"
    echo "  help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./build.sh           # Quick build"
    echo "  ./build.sh watch     # Development mode"
    echo "  ./build.sh full      # Complete build with tests"
    echo "  ./build.sh clean     # Clean output directory"
}

# Main script logic
main() {
    local option="${1:-default}"
    
    case "$option" in
        "clean")
            clean
            ;;
        "watch")
            check_prerequisites
            install_deps
            watch
            ;;
        "lint")
            check_prerequisites
            install_deps
            lint
            ;;
        "test")
            check_prerequisites
            install_deps
            test
            ;;
        "full")
            check_prerequisites
            install_deps
            lint
            compile
            test
            print_success "Full build completed successfully"
            ;;
        "dev")
            check_prerequisites
            install_deps
            compile
            # Determine workspace to open
            WORKSPACE_PATH="${2:-test-fixtures/basic}"
            if [ ! -d "$WORKSPACE_PATH" ]; then
                print_warning "Workspace '$WORKSPACE_PATH' not found. Opening current folder instead."
                WORKSPACE_PATH="."
            fi
            if ! command -v code &> /dev/null; then
                print_error "VS Code 'code' CLI not found. Install it from the Command Palette: 'Shell Command: Install 'code' command in PATH'."
                exit 1
            fi
            print_status "Launching VS Code Extension Development Host..."
            echo "Workspace: $WORKSPACE_PATH"
            echo "Tip: run 'npm run watch' in another terminal for live builds."
            code --disable-extensions --extensionDevelopmentPath="$(pwd)" "$WORKSPACE_PATH"
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        "default")
            check_prerequisites
            install_deps
            compile
            print_success "Build completed successfully"
            ;;
        *)
            print_error "Unknown option: $option"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Make sure we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Make sure you're in the project root directory."
    exit 1
fi

# Run main function with all arguments
main "$@"
