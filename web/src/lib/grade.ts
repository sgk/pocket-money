export type Grade =
  | "kinder"
  | "grade1"
  | "grade2"
  | "grade3"
  | "grade4"
  | "grade5"
  | "grade6"
  | "upper";

export const DEFAULT_GRADE: Grade = "grade1";

export const GRADE_OPTIONS: { value: Grade; label: string }[] = [
  { value: "kinder", label: "幼稚園以下" },
  { value: "grade1", label: "小学校1年生" },
  { value: "grade2", label: "小学校2年生" },
  { value: "grade3", label: "小学校3年生" },
  { value: "grade4", label: "小学校4年生" },
  { value: "grade5", label: "小学校5年生" },
  { value: "grade6", label: "小学校6年生" },
  { value: "upper", label: "中学生以上" },
];

const ELEMENTARY_GRADES: Grade[] = [
  "grade1",
  "grade2",
  "grade3",
  "grade4",
  "grade5",
  "grade6",
];

const NEXT_GRADE: Record<Grade, Grade> = {
  kinder: "kinder",
  grade1: "grade2",
  grade2: "grade3",
  grade3: "grade4",
  grade4: "grade5",
  grade5: "grade6",
  grade6: "upper",
  upper: "upper",
};

export const isGrade = (value: string | null): value is Grade =>
  Boolean(value) && GRADE_OPTIONS.some((option) => option.value === value);

const parseDate = (value: string | null) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

export const promoteGradeIfNeeded = (
  currentGrade: Grade,
  lastAccessAt: string | null,
  now: Date
) => {
  if (!ELEMENTARY_GRADES.includes(currentGrade)) {
    return currentGrade;
  }
  const yearStart = new Date(now.getFullYear(), 3, 1);
  if (now < yearStart) {
    return currentGrade;
  }
  const lastAccessDate = parseDate(lastAccessAt);
  if (!lastAccessDate) {
    return currentGrade;
  }
  if (lastAccessDate >= yearStart) {
    return currentGrade;
  }
  return NEXT_GRADE[currentGrade];
};
