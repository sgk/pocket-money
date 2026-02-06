import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useBootstrap, useOnboardingStatus } from "@/lib/query";
import type { BootstrapResponse } from "@/lib/types";

const COLOR_THEME_VALUES = ["cream", "mint", "sky", "pink"] as const;

export type ColorTheme = (typeof COLOR_THEME_VALUES)[number];

export const DEFAULT_COLOR_THEME: ColorTheme = "cream";

export const COLOR_THEME_OPTIONS: ReadonlyArray<{
  value: ColorTheme;
  label: string;
  description: string;
  swatches: readonly [string, string, string, string];
}> = [
  {
    value: "cream",
    label: "クリーム",
    description: "やさしい定番カラー",
    swatches: ["#fff9d6", "#36a5c5", "#ffb347", "#ffffff"],
  },
  {
    value: "mint",
    label: "みどり",
    description: "ふんわりミントカラー",
    swatches: ["#ecfff3", "#4caf7a", "#ffd766", "#ffffff"],
  },
  {
    value: "sky",
    label: "みずいろ",
    description: "さわやかスカイカラー",
    swatches: ["#effaff", "#3b9ad6", "#ffc96b", "#ffffff"],
  },
  {
    value: "pink",
    label: "ピンク",
    description: "あまいキャンディカラー",
    swatches: ["#fff1f7", "#e5679a", "#ffb07a", "#ffffff"],
  },
];

const isColorTheme = (value: unknown): value is ColorTheme =>
  typeof value === "string" && (COLOR_THEME_VALUES as readonly string[]).includes(value);

type ThemeContextValue = {
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { token, childId } = useAuth();
  const queryClient = useQueryClient();
  const onboarding = useOnboardingStatus();
  const isReady = onboarding.data?.state === "ready";
  const { data: bootstrap } = useBootstrap(isReady);
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(DEFAULT_COLOR_THEME);

  useEffect(() => {
    if (!token) {
      setColorThemeState(DEFAULT_COLOR_THEME);
      return;
    }
    const profileTheme = bootstrap?.profile?.colorTheme;
    setColorThemeState(isColorTheme(profileTheme) ? profileTheme : DEFAULT_COLOR_THEME);
  }, [token, bootstrap?.profile?.colorTheme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-color-theme", colorTheme);
  }, [colorTheme]);

  const setColorTheme = (next: ColorTheme) => {
    setColorThemeState(next);
    queryClient.setQueryData<BootstrapResponse | undefined>(
      ["bootstrap", childId],
      (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          profile: {
            ...current.profile,
            colorTheme: next,
          },
        };
      }
    );
    if (token) {
      void api.updateProfile(token, { colorTheme: next }, childId);
    }
  };

  const value = useMemo(
    () => ({
      colorTheme,
      setColorTheme,
    }),
    [colorTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("ThemeProvider が見つかりません");
  }
  return ctx;
};
