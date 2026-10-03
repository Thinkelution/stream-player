class StreamPlayer < Formula
  desc "Open-source M3U8/IPTV player with EPG support"
  homepage "https://github.com/ownsafeai/stream-player"
  version "0.1.0"

  if OS.mac?
    url "https://github.com/ownsafeai/stream-player/releases/download/v0.1.0/StreamPlayer-0.1.0.dmg"
    sha256 "REPLACE_WITH_ACTUAL_SHA256"

    def install
      app.install "StreamPlayer.app"
    end
  elsif OS.linux?
    url "https://github.com/ownsafeai/stream-player/releases/download/v0.1.0/stream-player-0.1.0.AppImage"
    sha256 "REPLACE_WITH_ACTUAL_SHA256"

    def install
      bin.install "stream-player-0.1.0.AppImage" => "stream-player"
    end
  end

  def caveats
    "StreamPlayer has been installed. Launch it from Applications folder (macOS) or run 'stream-player' from terminal."
  end
end
