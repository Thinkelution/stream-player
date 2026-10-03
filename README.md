# StreamPlayer

An open-source native Electron app for streaming M3U8/IPTV content with EPG (Electronic Program Guide) support. Works on macOS and Windows.

## Features

- 🎬 Play M3U8 playlists and IPTV streams
- 📺 EPG/Electronic Program Guide integration
- 🔍 Search and filter channels by name or group
- 📱 Responsive design with dark theme
- 🚀 Native desktop app using Electron
- 💻 Cross-platform (macOS, Windows, Linux)

## Installation

### From Homebrew (macOS)

```bash
brew tap ownsafeai/stream-player
brew install stream-player
```

### From Source

```bash
git clone https://github.com/ownsafeai/stream-player.git
cd stream-player
npm install
npm run dev
```

## Configuration

Create a `.env` file in the project root:

```env
REACT_APP_M3U_URL=http://your-iptv-service.com/get.php?username=YOUR_USERNAME&password=YOUR_PASSWORD&type=m3u_plus&output=mpegts
REACT_APP_EPG_URL=http://your-iptv-service.com/xmltv.php?username=YOUR_USERNAME&password=YOUR_PASSWORD
```

Copy `.env.example` as a template.

## Development

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
# macOS
npm run build-mac

# Windows
npm run build-win

# Both
npm run build
```

## How It Works

1. **M3U Playlist Parsing**: Fetches and parses M3U playlist format with channel metadata
2. **HLS Streaming**: Uses HLS.js for adaptive bitrate streaming
3. **EPG Integration**: Fetches and displays program guide data in XMLTV format
4. **Channel Management**: Search, filter, and organize channels by category

## License

MIT

## Privacy

This application connects to your configured IPTV provider. Ensure you have the appropriate rights to access streams.
