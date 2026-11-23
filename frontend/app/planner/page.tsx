import PlannerForm from "@/components/PlannerForm";
import { getDict } from "@/lib/session";

export const metadata = { title: "AI саякат пландоочу — Too Arna" };

export default async function PlannerPage() {
  const t = await getDict();
  return (
    <main className="mx-auto max-w-[920px] px-6 py-10 md:px-8 md:py-14">
      <div className="glow rounded-[36px] border border-line p-6 md:p-10">
        <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-sky">✨ AI</span>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.02em] md:text-5xl">{t.plannerTitle}</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">{t.plannerText}</p>
        <div className="mt-8">
          <PlannerForm t={t} />
        </div>
      </div>
    </main>
  );
}
