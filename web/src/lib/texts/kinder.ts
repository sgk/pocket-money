import { defineTexts, text, type TextEntry } from "./helpers";
import { grade1Texts } from "./grade1";
import type { TextKey } from "./upper";

export const kinderTexts = defineTexts<Record<TextKey, TextEntry>>({
  ...grade1Texts,
  dashboardSubtitle: text("いまのようすを みよう"),
  dashboardMonthIncome: text("こんげつ いれた"),
  dashboardMonthExpense: text("こんげつ だした"),
  labelDate: text("ひづけ"),
  labelAmount: text("きんがく"),
  labelBalance: text("のこり"),
  personalSettingsGradeDescription: text("がくねんで ことばが かわるよ"),
  personalSettingsGradeNote: text("4がつ1にちを すぎて はじめて ひらくと ひとつ すすむよ"),
});
