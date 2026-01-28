import { defineTexts, text, textWith, type TextEntry } from "./helpers";
import { grade1Texts, type TextKey } from "./grade1";

export const grade3Texts = defineTexts<Record<TextKey, TextEntry>>({
  ...grade1Texts,
  dashboardSubtitle: text("いまのようすを見よう"),
  dashboardInitialBalance: textWith(({ amount }) => `初めののこり ${amount ?? ""}`.trim()),
  dashboardMonthIncome: text("今月 いれた"),
  dashboardMonthExpense: text("今月 だした"),
  dashboardRecentTitle: text("さいきんの記録"),
  assetsSubtitle: text("いれものごとのノートを見よう"),
  ledgerSubtitleAll: text("ぜんぶまとめて見よう"),
  labelDate: text("日付"),
  labelAmount: text("金がく"),
  labelBalance: text("のこり"),
  filterPresetThisMonth: text("今月"),
  filterPresetLastMonth: text("先月"),
  filterPresetLast30: text("30日"),
  filterPresetCustom: text("その他"),
  unknownError: text("不明なエラー"),
});
