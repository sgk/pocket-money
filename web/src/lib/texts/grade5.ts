import { defineTexts, text, type TextEntry } from "./helpers";
import { grade6Texts } from "./grade6";
import type { TextKey } from "./upper";

export const grade5Texts = defineTexts<Record<TextKey, TextEntry>>({
  ...grade6Texts,
  navSummary: text("サマリー"),
  navAll: text("一覧"),
  dashboardSubtitle: text("いまの状況を確認"),
  assetsSubtitle: text("資産ごとのノートを見よう"),
  summaryLabel: text("サマリー"),
});
