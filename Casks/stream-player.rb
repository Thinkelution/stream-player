cask "stream-player" do
  version "0.1.16"
  sha256 "b91536b36fc7cdd93517cb6752cb1b416246f2d59f75380ff6669abf65fa1007"

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
