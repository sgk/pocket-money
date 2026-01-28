import { defineTexts, type TextEntry } from "./helpers";
import { upperTexts, type TextKey } from "./upper";

export const grade6Texts = defineTexts<Record<TextKey, TextEntry>>({
  ...upperTexts,
});
