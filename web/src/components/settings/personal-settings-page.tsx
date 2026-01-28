import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useText, useGradeOptions } from "@/lib/text";

export const PersonalSettingsPage = () => {
  const { t, grade, setGrade } = useText();
  const gradeOptions = useGradeOptions();

  return (
    <div className="flex min-h-0 flex-col">
      <Topbar title={t("personalSettingsTitle")} />
      <div className="flex-1 min-h-0 overflow-y-auto pt-4 pb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("personalSettingsGradeTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2">
              <span className="text-sm text-muted-foreground">
                {t("personalSettingsGradeDescription")}
              </span>
              <Select value={grade} onValueChange={(value) => setGrade(value as typeof grade)}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder={t("personalSettingsGradeLabel")} />
                </SelectTrigger>
                <SelectContent>
                  {gradeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("personalSettingsGradeNote")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
