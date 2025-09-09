"use client";

import { DefaultView } from "@/components/v2/default-view";
import { useThreadsSWR } from "@/hooks/useThreadsSWR";
import { GitLabAppProvider } from "@/providers/GitLabApp";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
import { MANAGER_GRAPH_ID } from "@open-swe/shared/constants";

function ChatPageComponent() {
  const { threads, isLoading: threadsLoading } = useThreadsSWR({
    assistantId: MANAGER_GRAPH_ID,
  });

  if (threadsLoading) {
    return <div>Loading threads...</div>;
  }

  if (!threads) {
    return <div>No threads found or an error occurred.</div>;
  }

  return (
      <div className="bg-background h-screen">
        <Suspense>
          <Toaster />
          <DefaultView
              threads={threads}
              threadsLoading={threadsLoading}
          />
        </Suspense>
      </div>
  );
}

export default function ChatPage() {
  return (
    <GitLabAppProvider>
      <ChatPageComponent />
    </GitLabAppProvider>
  );
}
