// id x y width height isMain — in CGGetActiveDisplayList order (screencapture -D uses index+1).
import CoreGraphics
var n: UInt32 = 0
var ids = [CGDirectDisplayID](repeating: 0, count: 16)
CGGetActiveDisplayList(16, &ids, &n)
for i in 0..<Int(n) {
  let b = CGDisplayBounds(ids[i])
  print(ids[i], b.origin.x, b.origin.y, b.width, b.height, CGDisplayIsMain(ids[i]) != 0)
}
