import { defineTexts, type TextEntry } from "./helpers";
import { grade1Texts, type TextKey } from "./grade1";

export const grade2Texts = defineTexts<Record<TextKey, TextEntry>>({
  ...grade1Texts,
});
