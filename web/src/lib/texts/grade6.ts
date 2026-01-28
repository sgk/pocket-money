import { defineTexts, type TextEntry } from "./helpers";
import { grade5Texts } from "./grade5";
import type { TextKey } from "./grade1";

export const grade6Texts = defineTexts<Record<TextKey, TextEntry>>({
  ...grade5Texts,
});
