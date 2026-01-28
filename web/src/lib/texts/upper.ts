import { defineTexts, text, type TextEntry } from "./helpers";
import { grade5Texts } from "./grade5";
import type { TextKey } from "./grade1";

export const upperTexts = defineTexts<Record<TextKey, TextEntry>>({
  ...grade5Texts,
  navSummary: text("概要"),
  navAll: text("取引一覧"),
  dashboardSubtitle: text("現在の状況を確認"),
  assetsSubtitle: text("資産ごとの記録を確認"),
  ledgerSubtitleAll: text("全体をまとめて確認"),
  summaryLabel: text("概要"),
  filterSearchPlaceholder: text("検索（相手/メモ）"),
  dataDeleteAccountButton: text("退会する"),
});
