import { ItemLibrary } from "@/components/ItemLibrary";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  return <ItemLibrary kind="phrase" q={q.trim()} />;
}
