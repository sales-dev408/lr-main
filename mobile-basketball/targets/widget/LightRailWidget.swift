import WidgetKit
import SwiftUI

// Rotating Light Rail Deals widget. The React Native app writes a JSON array
// of cards (featured deals, next games, upcoming events) into the shared App
// Group under `widget.items`; each timeline step cycles to the next card and
// taps deep-link into the matching tab via lrcard:// URLs.

private let appGroupId = "group.com.lightraildeals.app"
private let itemsKey = "widget.items"
private let stepMinutes = 20

struct WidgetItem: Codable {
    let kind: String
    let title: String
    let subtitle: String
    let detail: String
    let url: String
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let item: WidgetItem
}

private let fallbackItem = WidgetItem(
    kind: "tip",
    title: "Light Rail Deals",
    subtitle: "Deals, games, and events along the Valley Metro",
    detail: "Tap to open the app",
    url: "lrcard://"
)

private func loadItems() -> [WidgetItem] {
    guard
        let defaults = UserDefaults(suiteName: appGroupId),
        let raw = defaults.string(forKey: itemsKey),
        let data = raw.data(using: .utf8),
        let items = try? JSONDecoder().decode([WidgetItem].self, from: data),
        !items.isEmpty
    else {
        return [fallbackItem]
    }
    return items
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), item: fallbackItem)
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        completion(SimpleEntry(date: Date(), item: loadItems().first ?? fallbackItem))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
        let items = loadItems()
        let now = Date()
        // Rotate through every card once per cycle; the last entry lands ~4h
        // out on a full feed, then reloads to pick up fresher data.
        let count = min(items.count, 12)
        var entries: [SimpleEntry] = []
        for i in 0..<count {
            entries.append(SimpleEntry(
                date: now.addingTimeInterval(TimeInterval(i * stepMinutes * 60)),
                item: items[i]
            ))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

private func kindIcon(_ kind: String) -> String {
    switch kind {
    case "deal": return "tag.fill"
    case "game": return "sportscourt.fill"
    case "event": return "calendar.badge.clock"
    default: return "tram.fill"
    }
}

private func kindLabel(_ kind: String) -> String {
    switch kind {
    case "deal": return "Featured Deal"
    case "game": return "Next Game"
    case "event": return "Upcoming Event"
    default: return "Light Rail Deals"
    }
}

private let brandTeal = Color(red: 0.055, green: 0.455, blue: 0.565)   // #0e7490
private let brandDeep = Color(red: 0.082, green: 0.369, blue: 0.459)   // #155e75
private let brandCopper = Color(red: 0.918, green: 0.345, blue: 0.047) // #ea580c

struct MyWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        let item = entry.item
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: kindIcon(item.kind))
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(5)
                    .background(
                        Circle().fill(brandCopper)
                    )
                Text(kindLabel(item.kind).uppercased())
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.white.opacity(0.85))
                    .tracking(0.8)
                Spacer(minLength: 0)
            }

            Spacer(minLength: 6)

            Text(item.title)
                .font(.system(size: family == .systemSmall ? 15 : 17, weight: .bold))
                .foregroundStyle(.white)
                .lineLimit(2)

            Text(item.subtitle)
                .font(.system(size: family == .systemSmall ? 11 : 12, weight: .semibold))
                .foregroundStyle(.white.opacity(0.9))
                .lineLimit(2)
                .padding(.top, 2)

            if family != .systemSmall && !item.detail.isEmpty {
                Spacer(minLength: 6)
                HStack(spacing: 4) {
                    Image(systemName: "mappin")
                        .font(.system(size: 9, weight: .bold))
                    Text(item.detail)
                        .font(.system(size: 10, weight: .medium))
                }
                .foregroundStyle(.white.opacity(0.75))
                .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: item.url))
    }
}

@main
struct LightRailWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LightRailWidget", provider: Provider()) { entry in
            MyWidgetEntryView(entry: entry)
                .containerBackground(for: .widget) {
                    ZStack {
                        LinearGradient(
                            colors: [brandTeal, brandDeep],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        // Soft copper glow for depth over the teal gradient.
                        RadialGradient(
                            colors: [brandCopper.opacity(0.55), .clear],
                            center: .bottomTrailing,
                            startRadius: 0,
                            endRadius: 220
                        )
                    }
                }
        }
        .configurationDisplayName("Light Rail Deals")
        .description("Rotating deals, upcoming games, and events along the Valley Metro.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
