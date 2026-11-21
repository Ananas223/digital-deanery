import type { StudentProfile } from "@/lib/domain/profile";
import { getStudyFormLabel } from "@/lib/domain/profile";
import { formatNumber } from "@/lib/format";

type AcademicDetailsProps = {
  profile: StudentProfile;
};

/** Академические сведения читаются как документ, без редактируемых полей. */
export function AcademicDetails({ profile }: AcademicDetailsProps) {
  const studyDetails = [
    { label: "Группа", value: profile.group },
    { label: "Курс", value: `${formatNumber(profile.course)} курс` },
    { label: "Форма обучения", value: getStudyFormLabel(profile.studyForm) },
    { label: "Номер студенческого", value: profile.studentNumber },
  ];

  return (
    <div className="mt-5 space-y-6">
      <dl className="space-y-5">
        <div className="min-w-0 space-y-1.5">
          <dt className="text-sm leading-relaxed text-muted-foreground">Факультет</dt>
          <dd className="text-base leading-relaxed font-medium text-pretty break-words text-foreground sm:text-lg">
            {profile.faculty}
          </dd>
        </div>
        <div className="min-w-0 space-y-1.5">
          <dt className="text-sm leading-relaxed text-muted-foreground">Направление подготовки</dt>
          <dd className="text-base leading-relaxed font-medium text-pretty break-words text-foreground sm:text-lg">
            {profile.program}
          </dd>
        </div>
      </dl>
      <dl className="flex min-w-0 flex-wrap gap-x-6 gap-y-5 border-t border-border pt-5">
        {studyDetails.map((detail) => (
          <div key={detail.label} className="min-w-0 flex-1 basis-28 space-y-1.5">
            <dt className="text-sm leading-relaxed wrap-anywhere text-muted-foreground">
              {detail.label}
            </dt>
            <dd className="text-base leading-relaxed font-medium wrap-anywhere text-foreground">
              {detail.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
