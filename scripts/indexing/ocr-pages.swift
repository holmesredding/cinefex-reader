// Recognise the text on every page of the archive with Apple's Vision framework (macOS 13+).
//
// usage: swift scripts/indexing/ocr-pages.swift <reader folder> <media folder> [first-last] [--force]
//   <media folder>  where the issue files live as issues/<n>/assets/… (the JUJU Cinefex Reader library's
//                   "media" folder, or any folder laid out like it)
// writes scripts/indexing/data/page-text/<n>.json  {"<page ref>": "text…"}; issues already done are skipped
// unless --force is given. Text is in reading order: column by column, top to bottom.
import AppKit
import Foundation
import Vision

let force = CommandLine.arguments.contains("--force")
let args = CommandLine.arguments.filter { $0 != "--force" }
guard args.count >= 3 else {
    print("usage: swift ocr-pages.swift <reader folder> <media folder> [first-last]")
    exit(1)
}
let reader = URL(fileURLWithPath: args[1], isDirectory: true)
let media = URL(fileURLWithPath: args[2], isDirectory: true)
var range = 1...172
if args.count > 3 {
    let bits = args[3].split(separator: "-").compactMap { Int($0) }
    if bits.count == 2 { range = bits[0]...bits[1] } else if bits.count == 1 { range = bits[0]...bits[0] }
}
let outDir = reader.appendingPathComponent("scripts/indexing/data/page-text", isDirectory: true)
try? FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

func issueData(_ n: Int) -> [String: Any]? {
    let url = reader.appendingPathComponent("issues/\(n)/data.js")
    guard let text = try? String(contentsOf: url, encoding: .utf8),
          let start = text.firstIndex(of: "{"), let end = text.lastIndex(of: "}") else { return nil }
    return (try? JSONSerialization.jsonObject(with: Data(text[start...end].utf8))) as? [String: Any]
}

let mediaPattern = try! NSRegularExpression(pattern: #"data-media-src="([^"]+)""#)

func recognise(_ file: URL) -> String {
    guard let image = NSImage(contentsOf: file),
          let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return "" }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["en-US"]
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    guard (try? handler.perform([request])) != nil, let results = request.results else { return "" }
    let lines = results.compactMap { obs -> (CGRect, String)? in
        guard let best = obs.topCandidates(1).first else { return nil }
        return (obs.boundingBox, best.string)
    }
    return readingOrder(lines).map(\.1).joined(separator: "\n")
}

/// Column by column, top to bottom. Column starts are left edges shared by at least three lines.
func readingOrder(_ lines: [(CGRect, String)]) -> [(CGRect, String)] {
    let xs = lines.map { $0.0.minX }
    var starts = [CGFloat]()
    for x in xs.sorted() where xs.filter({ abs($0 - x) < 0.02 }).count >= 3 {
        if let last = starts.last, x - last < 0.04 { continue }
        starts.append(x)
    }
    func column(_ r: CGRect) -> Int { starts.lastIndex(where: { $0 <= r.minX + 0.02 }) ?? 0 }
    return lines.sorted { a, b in
        let ca = column(a.0), cb = column(b.0)
        return ca != cb ? ca < cb : a.0.midY > b.0.midY
    }
}

let started = Date()
var pagesDone = 0
for n in range {
    let out = outDir.appendingPathComponent("\(n).json")
    if !force && FileManager.default.fileExists(atPath: out.path) { continue }
    guard let issue = issueData(n), let pages = issue["pages"] as? [[String: Any]],
          let assets = issue["localAssets"] as? [String: [String: Any]] else {
        print("issue \(n): no data"); continue
    }
    var texts = [String](repeating: "", count: pages.count)
    var missing = 0
    let lock = NSLock()
    DispatchQueue.concurrentPerform(iterations: pages.count) { i in
        guard let file = pages[i]["file"] as? String,
              let html = try? String(contentsOf: reader.appendingPathComponent("issues/\(n)/\(file)"), encoding: .utf8) else { return }
        let ns = html as NSString
        var parts = [String]()
        for m in mediaPattern.matches(in: html, range: NSRange(location: 0, length: ns.length)) {
            let url = ns.substring(with: m.range(at: 1))
            guard let path = assets[url]?["path"] as? String else { continue }
            let f = media.appendingPathComponent(path)
            guard FileManager.default.fileExists(atPath: f.path) else { lock.withLock { missing += 1 }; continue }
            if url.lowercased().hasSuffix(".mp4") || url.lowercased().hasSuffix(".m4v") { continue }
            let t = autoreleasepool { recognise(f) }     // release each image as soon as it is read
            if !t.isEmpty { parts.append(t) }
        }
        lock.withLock { texts[i] = parts.joined(separator: "\n") }
    }
    var json = [String: String]()
    for (i, p) in pages.enumerated() { if let ref = p["ref"] as? String { json[ref] = texts[i] } }
    if let data = try? JSONSerialization.data(withJSONObject: json, options: [.sortedKeys]) { try? data.write(to: out) }
    pagesDone += pages.count
    let rate = Double(pagesDone) / max(1, Date().timeIntervalSince(started))
    print("issue \(n): \(pages.count) pages\(missing > 0 ? ", \(missing) images not in the library yet" : "") · \(String(format: "%.1f", rate)) pages/s")
}
print("done")
