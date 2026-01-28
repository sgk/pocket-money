import { defineTexts, type TextEntry } from "./helpers";
import { grade3Texts } from "./grade3";
import type { TextKey } from "./upper";

export const grade4Texts = defineTexts<Record<TextKey, TextEntry>>({
  ...grade3Texts,
});
