# OpenStreamPlayer

OpenStreamPlayer is a native Electron app for streaming M3U8/IPTV content with EPG (Electronic Program Guide), favorites, and responsive channel browsing. Works on macOS and Windows.

## Features

- 🎬 Play M3U8 playlists and IPTV streams
- 🎞️ Browse Xtream live TV, movies, and series catalogs
- 📺 EPG/Electronic Program Guide integration
- ⚙️ Custom live controls with Stop, quality, CC, mute, volume, and fullscreen
- ⚡ Xtream API loading for providers with slow M3U exports
- 🔍 Search, filter, and favorite channels
- 📱 Responsive modern interface with loading and empty states
- 🔠 Compact text by default with an optional larger font setting
- 🚀 Native desktop app using Electron
- 💻 Cross-platform (macOS, Windows, Linux)

## Installation

### From Homebrew (macOS)

```bash
brew tap thinkelution/tap
brew install --cask thinkelution/tap/stream-player
```

The current macOS release supports Apple Silicon. OpenStreamPlayer is installed
in `/Applications/OpenStreamPlayer.app` and can be opened from Applications or
with `open -a OpenStreamPlayer`.

### First launch on macOS

This release is ad-hoc signed, so its app bundle has a verifiable signature, but
it is not signed with an Apple Developer ID or notarized by Apple. macOS may block
it as an unidentified developer or display “damaged” even when its ad-hoc signature
is valid. Try **System Settings → Privacy & Security → Open Anyway** if that option
is offered, then confirm **Open**. See
[Apple's instructions](https://support.apple.com/102445).

If no exception is offered, users who trust this release can explicitly approve
only this installed app from Terminal. First verify the bundle; do not continue
if verification fails:

```bash
codesign --verify --deep --strict /Applications/OpenStreamPlayer.app && \
  xattr -dr com.apple.quarantine /Applications/OpenStreamPlayer.app
open -a OpenStreamPlayer
```

Removing quarantine skips Gatekeeper's first-launch check for this copy of the
app. An ad-hoc signature checks bundle integrity, not the publisher's identity or
Apple malware review. The cask does not remove quarantine automatically. An
upgrade may require approval again. Configure your playlist in **Settings**.

The macOS package is a Homebrew **cask**, as it installs a prebuilt `.app` from a
disk image. Maintainers should copy `Casks/stream-player.rb` into the same path in
`Thinkelution/homebrew-tap` and remove the old `Formula/stream-player.rb` there.
For each release, update the version and SHA-256 using the final uploaded DMG.
Do not replace an existing release asset after publishing its checksum; publish
a new version instead.

### Preparing a macOS release

Run `npm run build-mac`. It produces Apple Silicon DMG/ZIP artifacts in `dist/`.
The signing hook seals Electron's nested helpers/frameworks and the outer app,
then requires `codesign --verify --deep --strict` to pass before packaging. It uses
an available Developer ID identity, otherwise an ad-hoc identity. Ad-hoc releases
still need the first-launch approval above. Signing alone does not notarize an app.

Release builds prefill Settings with the public [iptv-org](https://github.com/iptv-org/iptv) playlist URL so first launch has an open sample source. EPG remains optional because public guide URLs vary by source. Configure your own legal playlist, XMLTV guide, or Xtream source in Settings for everyday use.

Before uploading the new version, mount its final DMG and verify the app inside:

```bash
hdiutil attach -nobrowse -readonly dist/OpenStreamPlayer-0.1.14-arm64.dmg
codesign --verify --deep --strict --verbose=2 "/Volumes/OpenStreamPlayer 0.1.14-arm64/OpenStreamPlayer.app"
hdiutil detach "/Volumes/OpenStreamPlayer 0.1.14-arm64"
shasum -a 256 dist/OpenStreamPlayer-0.1.14-arm64.dmg
```

Publish the DMG under the matching GitHub release tag, then update the version and
checksum in the tap's cask. The cask must point to the exact verified artifact.

### From Source

```bash
git clone https://github.com/Thinkelution/stream-player.git
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
2. **Xtream Catalog Loading**: Fetches live channels, VOD movies, and series metadata through Xtream Codes-compatible APIs
3. **HLS Streaming**: Uses HLS.js for adaptive bitrate streaming, quality selection, and subtitles when available
4. **EPG Integration**: Fetches and displays program guide data in XMLTV format
5. **Channel Management**: Search, filter, favorite, and organize channels by category

## License

MIT

## Privacy

This application connects to your configured IPTV provider or playlist URL. Ensure you have the appropriate rights to access streams. The default public playlist is provided by the [iptv-org](https://github.com/iptv-org/iptv) community project; check their repository for their terms, sources, and contribution guidelines. If you use public XMLTV data, review the [iptv-org EPG](https://github.com/iptv-org/epg) project as well.
