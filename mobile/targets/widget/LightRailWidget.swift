import WidgetKit
import SwiftUI

struct SimpleEntry: TimelineEntry {
    let date: Date
    let message: String
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(date: Date(), message: "Loading...")
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        completion(SimpleEntry(date: Date(), message: "Hello Widget"))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> ()) {
        let entry = SimpleEntry(date: Date(), message: "Updated!")
        completion(Timeline(entries: [entry], policy: .atEnd))
    }
}

struct MyWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        Text(entry.message)
            .padding()
    }
}

@main
struct LightRailWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LightRailWidget", provider: Provider()) { entry in
            MyWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Light Rail Deals")
        .description("Shows a simple message.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
