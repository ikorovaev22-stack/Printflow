import { notFound } from "next/navigation";
import { Screen } from "@/components/client/screen";
import { getCompanyBySlug } from "@/lib/auth";

export const metadata = { title: "Политика конфиденциальности" };

// 152-ФЗ policy template filled with the company's own details; the owner should have it checked by a lawyer
export default async function PrivacyScreen({ params }: PageProps<"/c/[slug]/privacy">) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();
  const contacts = [company.email, company.phone].filter(Boolean).join(", ");

  const sections: { title: string; body: React.ReactNode }[] = [
    {
      title: "Кто обрабатывает данные",
      body: (
        <>
          Оператор персональных данных — {company.name}
          {company.address && `, ${company.address}`}.{contacts && ` Контакты: ${contacts}.`}
        </>
      ),
    },
    {
      title: "Какие данные",
      body: "Имя и фамилия, телефон, email; ваши заказы, файлы макетов и переписка с менеджером в приложении; IP-адрес при входе — для защиты от подбора пароля.",
    },
    {
      title: "Зачем",
      body: "Чтобы принять и выполнить заказ, сообщать о его статусе на телефон и по email и отвечать на ваши вопросы в чате. Рекламных рассылок не делаем.",
    },
    {
      title: "Основание",
      body: "Ваше согласие, которое вы даёте при регистрации, и исполнение заказа (п. 1 и 5 ч. 1 ст. 6 Федерального закона № 152-ФЗ «О персональных данных»).",
    },
    {
      title: "Где хранятся и кому передаются",
      body: "На сервере в России, который типография арендует у хостинг-провайдера. Письма уходят через почтовый сервис типографии, уведомления на телефон — в зашифрованном виде через сервис уведомлений вашего браузера. Другим лицам данные не передаются, кроме случаев, предусмотренных законом.",
    },
    {
      title: "Сколько хранятся",
      body: "Пока у вас есть аккаунт. После удаления аккаунта данные удаляются в течение 30 дней, кроме тех, что нужно хранить по закону (например, документы по оплате).",
    },
    {
      title: "Ваши права",
      body: (
        <>
          Вы можете узнать, какие данные о вас хранятся, исправить их, отозвать согласие и удалить аккаунт — напишите
          {company.email ? ` на ${company.email}` : ""} или в чат приложения, ответим в течение 10 рабочих дней. Имя и телефон
          можно изменить самостоятельно в профиле.
        </>
      ),
    },
    {
      title: "Защита",
      body: "Вход по паролю, шифрованное соединение (HTTPS), разграничение доступа: каждый клиент видит только свои заказы, файлы и переписку.",
    },
  ];

  return (
    <Screen back={`/c/${slug}/register`} title="Политика конфиденциальности" eyebrow={company.name}>
      <div className="flex flex-col gap-2">
        {sections.map((s) => (
          <section key={s.title} className="rounded-card bg-card p-5">
            <h2 className="mb-2 text-lg font-semibold tracking-tight">{s.title}</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </div>
    </Screen>
  );
}
