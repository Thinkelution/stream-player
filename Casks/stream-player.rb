cask "stream-player" do
  version "0.1.6"
  sha256 "66c352d325e6195f1229d708d66f5b3d729b23f63845a02e1fbb242ab92625df"

  url "https://github.com/Thinkelution/stream-player/releases/download/v#{version}/OpenStreamPlayer-#{version}-arm64.dmg"
  name "OpenStreamPlayer"
  desc "M3U8/IPTV player with EPG support"
  homepage "https://github.com/Thinkelution/stream-player"

  depends_on arch: :arm64
  depends_on :macos

  app "OpenStreamPlayer.app"

  caveats <<~EOS
    OpenStreamPlayer is ad-hoc signed and is not notarized by Apple.
    If macOS blocks launch, try System Settings > Privacy & Security > Open Anyway.
    If that option is absent, users who trust this release may explicitly approve
    this app after verifying its signature:
      codesign --verify --deep --strict /Applications/OpenStreamPlayer.app &&
        xattr -dr com.apple.quarantine /Applications/OpenStreamPlayer.app
    This skips Gatekeeper's first-launch check for this app only.
    Launch OpenStreamPlayer, then configure your playlist in Settings.
  EOS
end
