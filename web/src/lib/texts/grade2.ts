import { defineTexts, type TextEntry } from "./helpers";
import { grade1Texts } from "./grade1";
import type { TextKey } from "./upper";

export const grade2Texts = defineTexts<Record<TextKey, TextEntry>>({
  ...grade1Texts,
});
