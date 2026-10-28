import AppKit
import SwiftUI

/// Endereço do servidor Studio. Sobrescreva com STUDIO_URL (ex.: http://localhost:4700).
let API = ProcessInfo.processInfo.environment["STUDIO_URL"] ?? "http://localhost:4599"

struct NewsItem: Identifiable, Decodable {
    let id: Int
    let title: String
    let hook: String?
    let caption: String?
    let hashtags: String?
    let lang: String?
    let created_local: String?
    let thumb_path: String?
    let file_path: String?
    let duration: Double?
    let format: String
    let brand: String
    let accent: String

    /// título que vai no post (o hook falado)
    var postTitle: String { (hook?.isEmpty == false ? hook! : title) }

    var langCode: String { (lang ?? "pt").uppercased() }

    /// "2026-10-24 17:29:31" (já no fuso local) -> "ontem 17:29"
    var whenText: String {
        guard let raw = created_local else { return "" }
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd HH:mm:ss"
        f.locale = Locale(identifier: "en_US_POSIX")
        guard let d = f.date(from: raw) else { return raw }
        let cal = Calendar.current
        let hm = DateFormatter()
        hm.dateFormat = "HH:mm"
        if cal.isDateInToday(d) { return "hoje \(hm.string(from: d))" }
        if cal.isDateInYesterday(d) { return "ontem \(hm.string(from: d))" }
        let dm = DateFormatter()
        dm.dateFormat = cal.isDate(d, equalTo: Date(), toGranularity: .year) ? "dd/MM" : "dd/MM/yy"
        return "\(dm.string(from: d)) \(hm.string(from: d))"
    }

    /// hashtags guardadas sem "#" -> texto pronto pra colar
    var hashtagsText: String {
        guard let raw = hashtags else { return "" }
        return raw.split(whereSeparator: { $0 == " " || $0 == "\n" })
            .map { "#" + $0.replacingOccurrences(of: "#", with: "") }
            .joined(separator: " ")
    }

    var fullPost: String {
        var parts = [postTitle]
        if let c = caption, !c.isEmpty { parts.append("") ; parts.append(c) }
        let tags = hashtagsText
        if !tags.isEmpty { parts.append(""); parts.append(tags) }
        return parts.joined(separator: "\n")
    }
}

struct Counts: Decodable {
    let new: Int
    let seen: Int
    let posted: Int
    let queued: Int
}

struct Summary: Decodable {
    let counts: Counts
    let news: [NewsItem]
    let alerts: [String]
    let rendering: Bool
}

struct VideoRow: Identifiable, Decodable {
    let id: Int
    let hook: String?
    let title: String
    let file_path: String?
    let brand: String
    let accent: String
    let format: String
    let duration: Double?
}

final class Store: ObservableObject {
    @Published var summary: Summary?
    @Published var offline = false
    @Published var busy = false

    var onStatusChange: ((Summary?) -> Void)?

    func refresh() {
        guard let url = URL(string: "\(API)/api/summary") else { return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 3
        URLSession.shared.dataTask(with: req) { data, _, err in
            DispatchQueue.main.async {
                if let data, err == nil, let s = try? JSONDecoder().decode(Summary.self, from: data) {
                    self.summary = s
                    self.offline = false
                    self.onStatusChange?(s)
                } else {
                    self.offline = true
                    self.onStatusChange?(nil)
                }
            }
        }.resume()
    }

    func openFile(_ path: String?) {
        guard let path else { return }
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
    }

    func play(_ path: String?) {
        guard let path else { return }
        NSWorkspace.shared.open(URL(fileURLWithPath: path))
    }

    func markPosted(_ id: Int) {
        post("/api/videos/\(id)/posted", ["network": "tiktok"]) { self.refresh() }
    }

    func markSeen(_ id: Int) {
        post("/api/videos/\(id)/seen", [:]) { self.refresh() }
    }

    func delete(_ id: Int) {
        guard let url = URL(string: "\(API)/api/videos/\(id)") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "DELETE"
        URLSession.shared.dataTask(with: req) { _, _, _ in
            DispatchQueue.main.async { self.refresh() }
        }.resume()
    }

    private func post(_ path: String, _ body: [String: String], done: @escaping () -> Void) {
        guard let url = URL(string: API + path) else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        URLSession.shared.dataTask(with: req) { _, _, _ in
            DispatchQueue.main.async(execute: done)
        }.resume()
    }

    func openStudio() {
        NSWorkspace.shared.open(URL(string: "\(API)")!)
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    let store = Store()
    var statusItem: NSStatusItem!
    var popover: NSPopover!
    var timer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // .accessory: só ícone na barra de menus, sem tile no Dock
        NSApp.setActivationPolicy(.accessory)
        installMainMenu()

        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = icon(dot: false)
            button.imagePosition = .imageOnly
            button.action = #selector(togglePopover)
            button.target = self
        }

        popover = NSPopover()
        // semitransient: sobrevive ao arrasto de um vídeo para o Finder/Desktop
        popover.behavior = .semitransient
        popover.animates = false
        popover.contentSize = NSSize(width: 404, height: 660)
        popover.contentViewController = NSHostingController(rootView: PopoverView(store: store))

        store.onStatusChange = { [weak self] s in
            guard let self, let button = self.statusItem.button else { return }
            let hasNew = (s?.counts.new ?? 0) > 0
            let rendering = s?.rendering ?? false
            button.image = self.icon(dot: hasNew, rendering: rendering)
            button.toolTip = self.tooltip(s)
        }

        store.refresh()
        timer = Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { _ in self.store.refresh() }
    }

    private func installMainMenu() {
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appItem.submenu = appMenu
        appMenu.addItem(withTitle: "Abrir painel", action: #selector(togglePopover), keyEquivalent: "o")
        appMenu.addItem(withTitle: "Abrir Studio no navegador", action: #selector(openStudioFromMenu), keyEquivalent: "s")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Sair do StudioBar", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        NSApp.mainMenu = mainMenu
    }

    @objc func openStudioFromMenu() {
        store.openStudio()
    }

    /// Clique no ícone do Dock abre o painel.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !popover.isShown { togglePopover() }
        return true
    }

    func tooltip(_ s: Summary?) -> String {
        guard let s else { return "Studio: offline" }
        var parts: [String] = []
        if s.counts.new > 0 { parts.append("\(s.counts.new) novo(s)") }
        if s.counts.queued > 0 { parts.append("\(s.counts.queued) na fila") }
        if s.alerts.count > 0 { parts.append("saldo baixo: " + s.alerts.joined(separator: ", ")) }
        // último gerado: título + hora, do jeito que vai pro post
        if let last = s.news.first {
            parts.append("último: \(last.postTitle) (\(last.langCode), \(last.whenText))")
        }
        return parts.isEmpty ? "Studio: tudo em ordem" : "Studio — " + parts.joined(separator: " · ")
    }

    func icon(dot: Bool, rendering: Bool = false) -> NSImage {
        let size = NSSize(width: 20, height: 20)
        let img = NSImage(size: size)
        img.lockFocus()
        let bar = NSBezierPath(roundedRect: NSRect(x: 2, y: 7, width: 16, height: 5.5), xRadius: 2, yRadius: 2)
        NSColor.labelColor.withAlphaComponent(0.85).setFill()
        bar.fill()
        if dot {
            let c = rendering ? NSColor.systemOrange : NSColor.systemGreen
            c.setFill()
            NSBezierPath(ovalIn: NSRect(x: 13.5, y: 12, width: 6, height: 6)).fill()
            NSColor.white.setStroke()
            let ring = NSBezierPath(ovalIn: NSRect(x: 13.5, y: 12, width: 6, height: 6))
            ring.lineWidth = 0.7
            ring.stroke()
        }
        img.unlockFocus()
        img.isTemplate = false
        return img
    }

    @objc func togglePopover() {
        guard let button = statusItem.button else { return }
        if popover.isShown {
            popover.performClose(nil)
        } else {
            store.refresh()
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            NSApp.activate(ignoringOtherApps: true)
        }
    }
}

struct PopoverView: View {
    @ObservedObject var store: Store

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Divider().opacity(0.35)
            if store.offline {
                offline
            } else if let s = store.summary {
                if !s.alerts.isEmpty { alerts(s.alerts) }
                if s.news.isEmpty { empty }
                else { list(s.news) }
            } else {
                ProgressView().padding(40)
            }
            Divider().opacity(0.35)
            footer
        }
        .frame(width: 404)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    var header: some View {
        HStack(alignment: .firstTextBaseline) {
            Text("Studio").font(.system(size: 15, weight: .bold))
            Spacer()
            if let s = store.summary {
                if s.rendering {
                    HStack(spacing: 5) {
                        Circle().fill(Color.orange).frame(width: 6, height: 6)
                        Text("renderizando").font(.system(size: 11)).foregroundStyle(.secondary)
                    }
                }
                Text("\(s.counts.new) novos · \(s.counts.posted) postados")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }

    func list(_ items: [NewsItem]) -> some View {
        ScrollView {
            VStack(spacing: 8) {
                ForEach(items) { v in
                    VideoCard(v: v, store: store)
                }
            }
            .padding(12)
        }
        .frame(maxHeight: 540)
    }

    var empty: some View {
        VStack(spacing: 8) {
            Text("Nenhum vídeo novo").font(.system(size: 13, weight: .medium))
            Text("Gera pela aba Gerar do Studio.").font(.system(size: 11)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 44)
    }

    func alerts(_ a: [String]) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            ForEach(a, id: \.self) { line in
                HStack(spacing: 6) {
                    Circle().fill(Color.red).frame(width: 5, height: 5)
                    Text(line).font(.system(size: 11))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.red.opacity(0.09))
    }

    var offline: some View {
        VStack(spacing: 10) {
            Text("Studio offline").font(.system(size: 13, weight: .medium))
            Text("Roda `./bin/studio start` no repo").font(.system(size: 11)).foregroundStyle(.secondary)
            Button("Tentar de novo") { store.refresh() }.controlSize(.small)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    var footer: some View {
        HStack {
            Button("Abrir Studio") { store.openStudio() }
                .buttonStyle(.link)
                .font(.system(size: 11))
            Spacer()
            Button("Atualizar") { store.refresh() }
                .buttonStyle(.link)
                .font(.system(size: 11))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }
}

struct VideoCard: View {
    let v: NewsItem
    @ObservedObject var store: Store
    @State private var confirmDelete = false
    @State private var copiedField: String?

    /// Copia pro clipboard com confirmação visual por 1,5s.
    private func copy(_ text: String, _ field: String) {
        guard !text.isEmpty else { return }
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(text, forType: .string)
        copiedField = field
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            if copiedField == field { copiedField = nil }
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            thumb

            VStack(alignment: .leading, spacing: 7) {
                header
                copyRow("título", v.postTitle, maxLines: 2) {
                    Text(v.postTitle)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.primary)
                }
                if let caption = v.caption, !caption.isEmpty {
                    copyRow("descrição", caption, maxLines: 2) {
                        Text(caption)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                }
                if !v.hashtagsText.isEmpty {
                    copyRow("hashtags", v.hashtagsText, maxLines: 1) {
                        Text(v.hashtagsText)
                            .font(.system(size: 9.5, design: .monospaced))
                            .foregroundStyle(Color(hex: "7fbf95"))
                    }
                }
                actions
            }
            Spacer(minLength: 0)
        }
        .padding(9)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.secondary.opacity(0.06)))
        .contentShape(RoundedRectangle(cornerRadius: 10))
        .onDrag { dragProvider() } preview: {
            HStack(spacing: 8) {
                Image(systemName: "film")
                Text(v.postTitle).font(.system(size: 11, weight: .medium)).lineLimit(1)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 8))
        }
        .help("clique no título, na descrição ou nas hashtags pra copiar · clique na miniatura pra abrir o vídeo")
    }

    var thumb: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 7).fill(Color.secondary.opacity(0.12))
            if let d = URL(string: "\(API)/api/videos/\(v.id)/thumb") {
                AsyncImage(url: d) { img in
                    img.resizable().aspectRatio(contentMode: .fill)
                } placeholder: {
                    ProgressView().controlSize(.small)
                }
            }
        }
        .frame(width: 58, height: 103)
        .clipShape(RoundedRectangle(cornerRadius: 7))
        .contentShape(RoundedRectangle(cornerRadius: 7))
        .onTapGesture { store.play(videoPath()) }
        .help("clique pra abrir o vídeo")
    }

    var header: some View {
        HStack(spacing: 6) {
            Text(v.brand)
                .font(.system(size: 10, weight: .semibold))
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color(hex: v.accent).opacity(0.18))
                .foregroundStyle(Color(hex: v.accent))
                .clipShape(Capsule())

            Text(v.langCode)
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(Color.secondary.opacity(v.langCode == "EN" ? 0.20 : 0.12))
                .foregroundStyle(v.langCode == "EN" ? Color.cyan : Color.secondary)
                .clipShape(Capsule())
                .help(v.langCode == "EN" ? "vídeo em inglês" : "vídeo em português")

            Text(v.format).font(.system(size: 10)).foregroundStyle(.tertiary).lineLimit(1)

            Spacer(minLength: 4)

            HStack(spacing: 3) {
                Image(systemName: "clock").font(.system(size: 8))
                Text(v.whenText).font(.system(size: 9.5))
            }
            .foregroundStyle(.secondary)
            .help("gerado em \(v.whenText)")
        }
    }

    /// linha clicável que copia; mostra "copiado" no lugar do ícone por 1,5s
    func copyRow<Content: View>(_ field: String, _ text: String, maxLines: Int, @ViewBuilder content: () -> Content) -> some View {
        HStack(alignment: .top, spacing: 5) {
            content()
                .lineLimit(maxLines)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Group {
                if copiedField == field {
                    Text("copiado")
                        .font(.system(size: 8.5, weight: .semibold))
                        .foregroundStyle(.green)
                } else {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 8.5))
                        .foregroundStyle(.tertiary)
                }
            }
            .frame(width: 34, alignment: .trailing)
        }
        .padding(.vertical, 1)
        .padding(.trailing, 1)
        .contentShape(Rectangle())
        .onTapGesture { copy(text, field) }
        .help("clique para copiar \(field)")
    }

    var actions: some View {
        HStack(spacing: 8) {
            Button {
                store.markPosted(v.id)
            } label: {
                Label("postei", systemImage: "checkmark.circle")
            }
            .buttonStyle(.borderless)
            .font(.system(size: 11))
            .foregroundStyle(.green)

            Button {
                // 2 toques: "apagar" -> "confirmar?" (volta sozinho em 4s)
                if confirmDelete {
                    confirmDelete = false
                    store.delete(v.id)
                } else {
                    confirmDelete = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
                        confirmDelete = false
                    }
                }
            } label: {
                Label(confirmDelete ? "confirmar?" : "apagar",
                      systemImage: confirmDelete ? "exclamationmark.triangle.fill" : "trash")
            }
            .buttonStyle(.borderless)
            .font(.system(size: 11, weight: confirmDelete ? .semibold : .regular))
            .foregroundStyle(confirmDelete ? Color.red : Color.secondary)

            Spacer()

            Button {
                copy(v.fullPost, "tudo")
            } label: {
                Label(copiedField == "tudo" ? "copiado" : "copiar tudo",
                      systemImage: copiedField == "tudo" ? "checkmark" : "square.on.square")
            }
            .buttonStyle(.borderless)
            .font(.system(size: 10))
            .foregroundStyle(copiedField == "tudo" ? Color.green : Color.secondary)
            .help("copia título + descrição + hashtags de uma vez")

            Button {
                store.play(videoPath())
            } label: {
                Image(systemName: "play.circle")
            }
            .buttonStyle(.borderless)
            .font(.system(size: 11))
            .foregroundStyle(.secondary)
            .help("abrir o vídeo")

            Button {
                store.openFile(videoPath())
            } label: {
                Image(systemName: "folder")
            }
            .buttonStyle(.borderless)
            .font(.system(size: 11))
            .foregroundStyle(.secondary)
            .help("mostrar no Finder")
        }
    }

    func videoPath() -> String? { v.file_path }

    /// Provider do arquivo real: arrastar para o Finder/Desktop copia o vídeo.
    func dragProvider() -> NSItemProvider {
        guard let p = videoPath(), FileManager.default.fileExists(atPath: p) else {
            return NSItemProvider()
        }
        let url = URL(fileURLWithPath: p)
        guard let provider = NSItemProvider(contentsOf: url) else { return NSItemProvider() }
        // sem a extensão: o Finder já acrescenta .mp4 (senão vira nome.mp4.mp4)
        provider.suggestedName = url.deletingPathExtension().lastPathComponent
        return provider
    }
}

extension Color {
    init(hex: String) {
        let h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: h).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
