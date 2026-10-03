cask "stream-player" do
  version "0.1.1"
  sha256 "7cb74c2235d4a808a7223f4cf53e1f105687eab1ba87504fed23960fe24e99ed"

  url "https://github.com/Thinkelution/stream-player/releases/download/v#{version}/StreamPlayer-#{version}-arm64.dmg"
  name "StreamPlayer"
  desc "M3U8/IPTV player with EPG support"
  homepage "https://github.com/Thinkelution/stream-player"

  depends_on arch: :arm64
  depends_on :macos

  app "StreamPlayer.app"

  caveats <<~EOS
    StreamPlayer is ad-hoc signed and is not notarized by Apple.
    If macOS blocks launch, try System Settings > Privacy & Security > Open Anyway.
    If that option is absent, users who trust this release may explicitly approve
    this app after verifying its signature:
      codesign --verify --deep --strict /Applications/StreamPlayer.app &&
        xattr -dr com.apple.quarantine /Applications/StreamPlayer.app
    This skips Gatekeeper's first-launch check for this app only.
    Launch StreamPlayer, then configure your playlist in Settings.
  EOS
end
