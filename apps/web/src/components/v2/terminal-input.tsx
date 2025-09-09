"use client";

import type React from "react";
import { v4 as uuidv4 } from "uuid";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { ArrowUp, Loader2 } from "lucide-react";
import { RepositoryBranchSelectors } from "../gitlab/repo-branch-selectors";
import { Button } from "../ui/button";
import { useStream } from "@langchain/langgraph-sdk/react";
import { useRouter } from "next/navigation";
import { useGitLabAppProvider } from "@/providers/GitLabApp";
import { GraphState } from "@open-swe/shared/open-swe/types";
import { Base64ContentBlock, HumanMessage } from "@langchain/core/messages";
import { toast } from "sonner";
import { DEFAULT_CONFIG_KEY, useConfigStore } from "@/hooks/useConfigStore";
import {
  API_KEY_REQUIRED_MESSAGE,
  MANAGER_GRAPH_ID,
} from "@open-swe/shared/constants";
import { ManagerGraphUpdate } from "@open-swe/shared/open-swe/manager/types";
import { useDraftStorage } from "@/hooks/useDraftStorage";
import { hasApiKeySet } from "@/lib/api-keys";
import { useUser } from "@/hooks/useUser";

interface TerminalInputProps {
  placeholder?: string;
  disabled?: boolean;
  apiUrl: string;
  assistantId: string;
  contentBlocks: Base64ContentBlock[];
  setContentBlocks: Dispatch<SetStateAction<Base64ContentBlock[]>>;
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  quickActionPrompt?: string;
  setQuickActionPrompt?: Dispatch<SetStateAction<string>>;
  autoAcceptPlan: boolean;
  setAutoAcceptPlan: Dispatch<SetStateAction<boolean>>;
  draftToLoad?: string;
}

// Toast 常量保持不变
const MISSING_API_KEYS_TOAST_CONTENT = (
    <p>
      {API_KEY_REQUIRED_MESSAGE} Please add your API key(s) in{" "}
      <a
          className="text-blue-500 underline underline-offset-1 dark:text-blue-400"
          href="/settings?tab=api-keys"
      >
        settings
      </a>
    </p>
);
const MISSING_API_KEYS_TOAST_OPTIONS = {
  richColors: true,
  duration: 30_000,
  closeButton: true,
};

export function TerminalInput({
                                placeholder = "Enter your command...",
                                disabled = false,
                                apiUrl,
                                assistantId,
                                contentBlocks,
                                setContentBlocks,
                                onPaste,
                                quickActionPrompt,
                                setQuickActionPrompt,
                                autoAcceptPlan,
                                setAutoAcceptPlan,
                                draftToLoad,
                              }: TerminalInputProps) {
  const { push } = useRouter();
  const { message, setMessage, clearCurrentDraft } = useDraftStorage();
  const { getConfig } = useConfigStore();
  const { selectedProject, projects } = useGitLabAppProvider();
  const [loading, setLoading] = useState(false);
  const { user, isLoading: isUserLoading } = useUser();

  const stream = useStream<GraphState>({
    apiUrl,
    assistantId,
    reconnectOnMount: true,
    fetchStateHistory: false,
  });

  const handleSend = async () => {
    if (!selectedProject) {
      toast.error("Please select a project first", {
        richColors: true,
        closeButton: true,
      });
      return;
    }

    if (!user) {
      toast.error("User not found. Please sign in first", {
        richColors: true,
        closeButton: true,
      });
      return;
    }

    const defaultConfig = getConfig(DEFAULT_CONFIG_KEY);
    console.log(defaultConfig)

    if (!hasApiKeySet(defaultConfig)) {
      toast.error(
          MISSING_API_KEYS_TOAST_CONTENT,
          MISSING_API_KEYS_TOAST_OPTIONS,
      );
      return;
    }

    const currentProject = projects.find(p => p.id === selectedProject.id);
    if (currentProject && !currentProject.issues_enabled) {
      toast.error(
          "Open SWE requires the Issues feature to be enabled on the project.",
          {
            richColors: true,
            closeButton: true,
            duration: 10_000,
          },
      );
      return;
    }

    setLoading(true);
    const trimmedMessage = message.trim();

    if (trimmedMessage.length > 0 || contentBlocks.length > 0) {
      const newHumanMessage = new HumanMessage({
        id: uuidv4(),
        content: [
          ...(trimmedMessage.length > 0
              ? [{ type: "text", text: trimmedMessage }]
              : []),
          ...contentBlocks,
        ],
      });

      try {
        const newThreadId = uuidv4();
        const pathParts = selectedProject.full_name.split("/");
        const owner = pathParts[0];
        const repo = pathParts.slice(1).join("/");

        const runInput: ManagerGraphUpdate = {
          messages: [newHumanMessage],
          targetRepository: { owner, repo },
          autoAcceptPlan,
        };

        const run = await stream.client.runs.create(
            newThreadId,
            MANAGER_GRAPH_ID,
            {
              input: runInput,
              config: {
                recursion_limit: 400,
                configurable: {
                  ...defaultConfig,
                },
              },
              ifNotExists: "create",
              streamResumable: true,
              streamMode: ["values", "messages-tuple", "custom"],
            },
        );

        sessionStorage.setItem(`lg:stream:${newThreadId}`, run.run_id);
        try {
          const initialMessageData = {
            message: newHumanMessage,
            timestamp: new Date().toISOString(),
          };
          sessionStorage.setItem(
              `lg:initial-message:${newThreadId}`,
              JSON.stringify(initialMessageData),
          );
        } catch (error) {
          console.error("Failed to store initial message in sessionStorage:", error);
        }

        push(`/chat/${newThreadId}`);
        clearCurrentDraft();
        setMessage("");
        setContentBlocks([]);
        setAutoAcceptPlan(false);
      } catch (e) {
        if (
            typeof e === "object" && e !== null && "message" in e &&
            typeof e.message === "string" && e.message.includes(API_KEY_REQUIRED_MESSAGE)
        ) {
          toast.error(
              MISSING_API_KEYS_TOAST_CONTENT,
              MISSING_API_KEYS_TOAST_OPTIONS,
          );
        } else {
          console.error("Failed to create run:", e);
          toast.error("An unexpected error occurred while starting the task.");
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (quickActionPrompt && message !== quickActionPrompt) {
      setMessage(quickActionPrompt);
      setQuickActionPrompt?.("");
    }
  }, [quickActionPrompt, message, setMessage, setQuickActionPrompt]);

  useEffect(() => {
    if (draftToLoad) {
      setMessage(draftToLoad);
    }
  }, [draftToLoad, setMessage]);

  return (
      <div className="border-border bg-muted hover:border-muted-foreground/50 hover:bg-muted/80 focus-within:border-muted-foreground/70 focus-within:bg-muted/80 focus-within:shadow-muted-foreground/20 rounded-md border p-2 font-mono text-xs transition-all duration-200 focus-within:shadow-md">
        <div className="text-foreground flex items-center gap-1">
          <div
              className="border-border bg-background/50 flex items-center gap-1 rounded-md border p-1 transition-colors duration-200">
            <span className="text-muted-foreground">open-swe</span>
            <span className="text-muted-foreground/70">@</span>
            <span className="text-muted-foreground">gitlab</span>
          </div>

          <RepositoryBranchSelectors/>

          <span className="text-muted-foreground">$</span>

          <Button
              onClick={handleSend}
              disabled={disabled || !message.trim() || !selectedProject || isUserLoading || loading}
              size="icon"
              variant="brand"
              className="ml-auto size-8 ..."
          >
            {loading ? (
                <Loader2 className="h-4 w-4 animate-spin"/>
            ) : (
                <ArrowUp className="size-4"/>
            )}
          </Button>
        </div>

        <div className="my-2 flex gap-2">
          <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={placeholder}
              disabled={disabled}
              className="text-foreground ..."
              rows={6}
              onPaste={onPaste}
          />
        </div>

        <div className="text-muted-foreground mt-1 text-xs">
          Press Cmd+Enter to send
        </div>
      </div>
  );
}