// On-screen windows: "pid owner | title | x y w h". Used to confirm staging before filming.
import CoreGraphics
import Foundation
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as! [[String: Any]]
for w in list {
  guard (w[kCGWindowLayer as String] as? Int ?? -1) == 0 else { continue }
  let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
  print(w[kCGWindowOwnerPID as String] ?? "", w[kCGWindowOwnerName as String] ?? "", "|",
        w[kCGWindowName as String] ?? "", "|", b["X"] ?? "", b["Y"] ?? "", b["Width"] ?? "", b["Height"] ?? "")
}
