// Current mouse position in global display coordinates: "x y".
import CoreGraphics
let p = CGEvent(source: nil)!.location
print(p.x, p.y)
