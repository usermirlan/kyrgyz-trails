import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getDict, getUser } from "@/lib/session";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next = "/" }, t, user] = await Promise.all([searchParams, getDict(), getUser()]);
  if (user) redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">{t.login}</h1>
      <AuthForm mode="login" next={next} t={t} />
    </main>
  );
}
