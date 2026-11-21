import type { RequestTypeCode } from "@/lib/validation/requests";

/** Public form descriptions for the four types supported by the v4 contract. */
export const REQUEST_TYPE_DETAILS: Record<
  RequestTypeCode,
  { title: string; description: string; needed: string }
> = {
  STUDY_CERTIFICATE: {
    title: "Справка об обучении",
    description: "Подтвердить, что вы учитесь в университете.",
    needed: "Место предоставления справки",
  },
  PLACE_REQUIREMENT: {
    title: "Справка по месту требования",
    description: "Подготовить справку для конкретной организации.",
    needed: "Название организации и место предоставления",
  },
  ACADEMIC_LEAVE: {
    title: "Академический отпуск",
    description: "Подать заявление на перерыв в обучении.",
    needed: "Причина, дата начала и дата окончания",
  },
  RETAKE: {
    title: "Пересдача",
    description: "Обратиться по поводу пересдачи дисциплины.",
    needed: "Дисциплина и причина пересдачи",
  },
};
