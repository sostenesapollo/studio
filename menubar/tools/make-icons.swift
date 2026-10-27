// Ícone do app StudioBar (Dock/Finder): claquete em dourado sobre fundo escuro,
// as cores do Studio (--gold #c8a24a, --bg #0a0b0d).
// Rodar:  swift tools/make-icons.swift
import AppKit
import Foundation

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assets = root.appendingPathComponent("assets")
try? FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)

func symbol(_ name: String, size: CGFloat, weight: NSFont.Weight = .semibold) -> NSImage? {
    let cfg = NSImage.SymbolConfiguration(pointSize: size, weight: weight)
    return NSImage(systemSymbolName: name, accessibilityDescription: nil)?
        .withSymbolConfiguration(cfg)
}

func appIcon(pixels: Int) -> NSImage {
    let img = NSImage(size: NSSize(width: pixels, height: pixels))
    img.lockFocus()
    NSColor.clear.setFill()
    NSRect(x: 0, y: 0, width: pixels, height: pixels).fill()

    let inset = CGFloat(pixels) * 0.085
    let rect = NSRect(x: inset, y: inset, width: CGFloat(pixels) - inset * 2, height: CGFloat(pixels) - inset * 2)
    let radius = rect.width * 0.2237
    let path = NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)

    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.35)
    shadow.shadowBlurRadius = CGFloat(pixels) * 0.03
    shadow.shadowOffset = NSSize(width: 0, height: -CGFloat(pixels) * 0.012)
    NSGraphicsContext.saveGraphicsState()
    shadow.set()
    NSColor(calibratedWhite: 0.04, alpha: 1).setFill()
    path.fill()
    NSGraphicsContext.restoreGraphicsState()

    let gradient = NSGradient(colors: [
        NSColor(calibratedRed: 0.13, green: 0.14, blue: 0.16, alpha: 1),
        NSColor(calibratedRed: 0.03, green: 0.035, blue: 0.045, alpha: 1),
    ])!
    gradient.draw(in: path, angle: -90)

    // fio dourado na borda
    NSGraphicsContext.saveGraphicsState()
    let gold = NSColor(calibratedRed: 0.784, green: 0.635, blue: 0.290, alpha: 1)
    gold.withAlphaComponent(0.55).setStroke()
    let border = NSBezierPath(roundedRect: rect.insetBy(dx: 1.5, dy: 1.5), xRadius: radius - 1, yRadius: radius - 1)
    border.lineWidth = max(1, CGFloat(pixels) * 0.006)
    border.stroke()
    NSGraphicsContext.restoreGraphicsState()

    if let s = symbol("film.fill", size: CGFloat(pixels) * 0.44, weight: .semibold) {
        let tinted = NSImage(size: s.size)
        tinted.lockFocus()
        let r = NSRect(origin: .zero, size: s.size)
        s.draw(in: r)
        gold.set()
        r.fill(using: .sourceAtop)
        tinted.unlockFocus()
        let w = s.size.width, h = s.size.height
        tinted.draw(in: NSRect(
            x: (CGFloat(pixels) - w) / 2,
            y: (CGFloat(pixels) - h) / 2,
            width: w, height: h))
    }

    img.unlockFocus()
    return img
}

func writePNG(_ img: NSImage, pixels: Int, url: URL) {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    rep.size = NSSize(width: pixels, height: pixels)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSGraphicsContext.current?.imageInterpolation = .high
    img.draw(in: NSRect(x: 0, y: 0, width: pixels, height: pixels))
    NSGraphicsContext.restoreGraphicsState()
    try! rep.representation(using: .png, properties: [:])!.write(to: url)
}

writePNG(appIcon(pixels: 1024), pixels: 1024, url: assets.appendingPathComponent("AppIcon.png"))

let iconset = assets.appendingPathComponent("AppIcon.iconset")
try? FileManager.default.removeItem(at: iconset)
try! FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
for base in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let px = base * scale
        let name = scale == 1 ? "icon_\(base)x\(base).png" : "icon_\(base)x\(base)@2x.png"
        writePNG(appIcon(pixels: px), pixels: px, url: iconset.appendingPathComponent(name))
    }
}

let p = Process()
p.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
p.arguments = ["-c", "icns", iconset.path, "-o", assets.appendingPathComponent("AppIcon.icns").path]
try! p.run()
p.waitUntilExit()
try? FileManager.default.removeItem(at: iconset)

print("ok: \(assets.path)")
