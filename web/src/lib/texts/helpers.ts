export type TextParams = {
  amount?: string;
  balance?: string;
  name?: string;
  assetName?: string;
};

export type TextEntry = (params?: TextParams) => string;

export const text = (value: string): TextEntry => () => value;

export const textWith =
  (builder: (params: TextParams) => string): TextEntry =>
  (params) =>
    builder(params ?? {});

export const defineTexts = <T extends Record<string, TextEntry>>(texts: T) => texts;
