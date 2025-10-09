# DevPulse - Electron App

This is the Electron version of DevPulse, a clean GitHub notifications app. The app works cross-platform on macOS, Windows, and Linux.

## Development

To run the app in development mode:

```bash
npm run dev
```

This will start both the Next.js development server and the Electron app.

### Development Scripts

- `npm run dev` - Run the app in development mode (Next.js + Electron)
- `npm run next:dev` - Run only the Next.js development server
- `npm run electron:dev` - Run only the Electron app (requires Next.js to be running)

## Building

### Prerequisites

Before building, make sure you have:

1. Node.js installed (v18 or higher recommended)
2. All dependencies installed: `npm install`

### Build the App

To build the app for all platforms:

```bash
npm run electron:build
```

### Platform-Specific Builds

Build for specific platforms:

```bash
# macOS (creates .dmg and .zip)
npm run electron:build:mac

# Windows (creates .exe installer and portable .exe)
npm run electron:build:win

# Linux (creates .AppImage, .deb, and .rpm)
npm run electron:build:linux
```

### Build Outputs

Built applications will be in the `dist/` directory:

- **macOS**: `dist/DevPulse-{version}.dmg` and `dist/DevPulse-{version}-mac.zip`
- **Windows**: `dist/DevPulse Setup {version}.exe` and `dist/DevPulse {version}.exe` (portable)
- **Linux**: `dist/DevPulse-{version}.AppImage`, `dist/devpulse_{version}_amd64.deb`, `dist/devpulse-{version}.x86_64.rpm`

## Architecture

The app uses:

- **Electron** - Desktop application framework
- **Next.js** - React framework with static export
- **electron-builder** - Build and package tool

### Key Files

- `electron/main.js` - Electron main process (window management, notifications)
- `electron/preload.js` - Preload script for secure IPC communication
- `electron-builder.json` - Build configuration for all platforms
- `next.config.ts` - Next.js configuration with static export

## Features

- Native desktop notifications
- Cross-platform support (Mac, Windows, Linux)
- Offline support
- Native window controls
- Auto-updater ready (configure in electron-builder.json)

## Notes

- The app uses Next.js static export (`output: 'export'`), which means it doesn't require a Node.js server to run
- Service workers are disabled in the Electron version - native notifications are used instead
- Images are unoptimized for Electron compatibility
- The app requires network connectivity for Supabase authentication and data

## Troubleshooting

### App won't start in development

1. Make sure port 3000 is available
2. Try running `npm run next:dev` first, then `npm run electron:dev` in a separate terminal

### Build fails

1. Make sure you have the latest dependencies: `npm install`
2. Clear the build cache: `rm -rf dist/ out/`
3. Try building again

### Icons not showing

The default build configuration expects icon files in the `build/` directory:
- macOS: `build/icon.icns`
- Windows: `build/icon.ico`
- Linux: `build/icons/` (various PNG sizes)

You can generate these from your existing SVG icons or create custom ones.
