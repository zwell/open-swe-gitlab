import "@langchain/langgraph/zod";
import { z } from "zod";
import {
  Annotation,
  LangGraphRunnableConfig,
  MessagesAnnotation,
} from "@langchain/langgraph";

type PlanItem = {
  id: string;
  plan: string;
  completed: boolean;
};

export const GraphAnnotation = Annotation.Root({
  messages: MessagesAnnotation.spec.messages,
  plan: Annotation<PlanItem[]>({
    reducer: (_state, update) => update,
    default: () => [],
  }),
});

export type GraphState = typeof GraphAnnotation.State;
export type GraphUpdate = typeof GraphAnnotation.Update;

export const MCPConfig = z.object({
  /**
   * The MCP server URL.
   */
  url: z.string(),
  /**
   * The list of tools to provide to the LLM.
   */
  tools: z.array(z.string()),
});

export const GraphConfiguration = z.object({
  /**
   * The model ID to use for the reflection generation.
   * Should be in the format `provider/model_name`.
   * Defaults to `anthropic/claude-3-7-sonnet-latest`.
   */
  modelName: z
    .string()
    .optional()
    .langgraph.metadata({
      x_lg_ui_config: {
        type: "select",
        default: "anthropic/claude-3-7-sonnet-latest",
        description: "The model to use in all generations",
        options: [
          {
            label: "Claude 3.7 Sonnet",
            value: "anthropic/claude-3-7-sonnet-latest",
          },
          {
            label: "Claude 3.5 Sonnet",
            value: "anthropic/claude-3-5-sonnet-latest",
          },
          {
            label: "GPT 4o",
            value: "openai/gpt-4o",
          },
          {
            label: "GPT 4.1",
            value: "openai/gpt-4.1",
          },
          {
            label: "o3",
            value: "openai/o3",
          },
          {
            label: "o3 mini",
            value: "openai/o3-mini",
          },
          {
            label: "o4",
            value: "openai/o4",
          },
        ],
      },
    }),
  /**
   * The temperature to use for the reflection generation.
   * Defaults to `0.7`.
   */
  temperature: z
    .number()
    .optional()
    .langgraph.metadata({
      x_lg_ui_config: {
        type: "slider",
        default: 0.7,
        min: 0,
        max: 2,
        step: 0.1,
        description: "Controls randomness (0 = deterministic, 2 = creative)",
      },
    }),
  /**
   * The maximum number of tokens to generate.
   * Defaults to `1000`.
   */
  maxTokens: z
    .number()
    .optional()
    .langgraph.metadata({
      x_lg_ui_config: {
        type: "number",
        default: 4000,
        min: 1,
        description: "The maximum number of tokens to generate",
      },
    }),
  systemPrompt: z
    .string()
    .optional()
    .langgraph.metadata({
      x_lg_ui_config: {
        type: "textarea",
        placeholder: "Enter a system prompt...",
        description: "The system prompt to use in all generations",
      },
    }),
  /**
   * MCP configuration for tool selection
   */
  mcpConfig: z
    .lazy(() => MCPConfig)
    .optional()
    .langgraph.metadata({
      x_lg_ui_config: {
        type: "mcp",
        // Add custom tools here.
        // default: {
        //   tools: ["Math_Divide", "Math_Mod"]
        // }
      },
    }),
});

export type GraphConfig = LangGraphRunnableConfig<
  z.infer<typeof GraphConfiguration> & {
    thread_id: string;
    assistant_id: string;
  }
>;
