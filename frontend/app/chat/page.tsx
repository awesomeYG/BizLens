"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SimpleChatPanel from "@/components/SimpleChatPanel";
import { getCurrentUser } from "@/lib/user-store";

export default function ChatPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [dataSummary, setDataSummary] = useState("");

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return <div className="min-h-screen bg-zinc-950" />;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <SimpleChatPanel onDataSummaryChange={setDataSummary} />
    </div>
  );
}
