import PlannerForm from "@/components/PlannerForm";
import { getDict } from "@/lib/session";

export const metadata = { title: "AI саякат пландоочу — Too Arna" };

export default async function PlannerPage() {
  const t = await getDict();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">{t.plannerTitle}</h1>
      <p className="mt-2 text-stone/70">{t.plannerText}</p>
      <div className="mt-6">
        <PlannerForm t={t} />
      </div>
    </main>
  );
}
