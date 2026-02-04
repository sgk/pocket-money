import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { storage, STORAGE_KEYS } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import { useBootstrap, useOnboardingStatus } from "@/lib/query";
import { api } from "@/lib/api";
import {
  DEFAULT_GRADE,
  GRADE_OPTIONS,
  isGrade,
  promoteGradeIfNeeded,
  type Grade,
} from "@/lib/grade";
import { kinderTexts } from "@/lib/texts/kinder";
import { grade1Texts } from "@/lib/texts/grade1";
import { grade2Texts } from "@/lib/texts/grade2";
import { grade3Texts } from "@/lib/texts/grade3";
import { grade4Texts } from "@/lib/texts/grade4";
import { grade5Texts } from "@/lib/texts/grade5";
import { grade6Texts } from "@/lib/texts/grade6";
import { upperTexts, type TextDictionary, type TextKey } from "@/lib/texts/upper";
import type { TextParams } from "@/lib/texts/helpers";

const TEXTS: Record<Grade, TextDictionary> = {
  kinder: kinderTexts,
  grade1: grade1Texts,
  grade2: grade2Texts,
  grade3: grade3Texts,
  grade4: grade4Texts,
  grade5: grade5Texts,
  grade6: grade6Texts,
  upper: upperTexts,
};

const GRADE_OPTION_LABEL_KEYS: Record<Grade, TextKey> = {
  kinder: "gradeOptionKinder",
  grade1: "gradeOptionGrade1",
  grade2: "gradeOptionGrade2",
  grade3: "gradeOptionGrade3",
  grade4: "gradeOptionGrade4",
  grade5: "gradeOptionGrade5",
  grade6: "gradeOptionGrade6",
  upper: "gradeOptionUpper",
};

type TextContextValue = {
  grade: Grade;
  setGrade: (grade: Grade) => void;
  t: (key: TextKey, params?: TextParams) => string;
};

const TextContext = createContext<TextContextValue | undefined>(undefined);

export const TextProvider = ({ children }: { children: React.ReactNode }) => {
  const { token, childId } = useAuth();
  const onboarding = useOnboardingStatus();
  const isReady = onboarding.data?.state === "ready";
  const { data: bootstrap } = useBootstrap(isReady);
  const storedGradeRef = useRef<Grade | null | "unset">("unset");
  if (storedGradeRef.current === "unset") {
    const raw = storage.getGrade();
    storedGradeRef.current = isGrade(raw) ? raw : null;
  }
  const storedGrade = storedGradeRef.current as Grade | null;
  const [grade, setGradeState] = useState<Grade>(storedGrade ?? DEFAULT_GRADE);
  const lastSyncedProfileGradeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const now = new Date();
    const baseGrade = storedGrade ?? DEFAULT_GRADE;
    const promoted = promoteGradeIfNeeded(baseGrade, storage.getLastAccessAt(), now);
    if (promoted !== baseGrade) {
      storage.setGrade(promoted);
      setGradeState(promoted);
    } else if (!storedGrade) {
      storage.setGrade(baseGrade);
    }
    storage.setLastAccessAt(now.toISOString());
  }, []);

  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEYS.grade) {
        return;
      }
      const next = isGrade(event.newValue) ? event.newValue : DEFAULT_GRADE;
      if (next === grade) {
        return;
      }
      if (!isGrade(event.newValue)) {
        storage.setGrade(next);
      }
      setGradeState(next);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [grade]);

  const setGrade = (next: Grade) => {
    if (!childId) {
      storage.setGrade(next);
    }
    setGradeState(next);
    if (token) {
      void api.updateProfile(token, { grade: next }, childId);
    }
  };

  useEffect(() => {
    const profileGrade = bootstrap?.profile?.grade;
    if (profileGrade && isGrade(profileGrade)) {
      if (profileGrade !== lastSyncedProfileGradeRef.current) {
        lastSyncedProfileGradeRef.current = profileGrade;
        setGradeState(profileGrade);
        if (!childId) {
          storage.setGrade(profileGrade);
        }
      }
    } else if (!childId && !profileGrade) {
      const stored = storage.getGrade();
      if (isGrade(stored)) {
        setGradeState(stored);
      }
    }
  }, [childId, bootstrap]);

  const value = useMemo(
    () => ({
      grade,
      setGrade,
      t: (key: TextKey, params?: TextParams) => TEXTS[grade][key](params),
    }),
    [grade]
  );

  return <TextContext.Provider value={value}>{children}</TextContext.Provider>;
};

export const useText = () => {
  const ctx = useContext(TextContext);
  if (!ctx) {
    throw new Error("TextProvider が見つかりません");
  }
  return ctx;
};

export const useGradeOptions = () => {
  const { t } = useText();
  return GRADE_OPTIONS.map((option) => ({
    value: option.value,
    label: t(GRADE_OPTION_LABEL_KEYS[option.value]),
  }));
};
