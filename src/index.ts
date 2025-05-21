import { END, START, StateGraph } from "@langchain/langgraph";
import { GraphAnnotation, GraphConfiguration, GraphState } from "./types.js";
import {
  generatePlan,
  initialize,
  generateAction,
  takeAction,
  rewritePlan,
  summarizeSession,
} from "./nodes/index.js";
import { isAIMessage, isToolMessage } from "@langchain/core/messages";

/**
 * After generating a plan, ensure there is an approved tool message.
 * If there is, route to the generate-action node. Otherwise, route to the rewrite-plan node.
 */
function routeAfterPlan(state: GraphState): "generate-action" | "rewrite-plan" {
  const { messages } = state;
  // Search for a tool message responding to the "session_plan" tool call where the content is "approved"
  const planApprovedMessage = messages.find(
    (m) =>
      isToolMessage(m) && m.name === "session_plan" && m.content === "approved",
  );
  if (planApprovedMessage) {
    return "generate-action";
  }
  // If this does not exist, we should rewrite the plan.
  return "rewrite-plan";
}

/**
 * After taking action, ensure there is an AI message with tool calls.
 * If there is, route to the take-action node. Otherwise, end the graph.
 * We do not want to route to the summarize session node here, as the generation
 * likely means the LLM is asking a question, or failed to generate an action.
 */
function takeActionOrEnd(state: GraphState): typeof END | "take-action" {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  // If the message is an AI message, and it has tool calls, we should take action.
  if (isAIMessage(lastMessage) && lastMessage.tool_calls?.length) {
    return "take-action";
  }
  return END;
}

/**
 * After taking action, check if there are any uncompleted plan items.
 * If there are, route to the generate-action node. Otherwise, route to the summarize-session node.
 * The summarize session node is the final node, and will end the graph.
 */
function generateActionOrSummarize(
  state: GraphState,
): "generate-action" | "summarize-session" {
  const { plan } = state;

  const hasUncompletedPlanItems = !!plan.filter((item) => !item.completed)
    .length;
  if (hasUncompletedPlanItems) {
    return "generate-action";
  }
  return "summarize-session";
}

const workflow = new StateGraph(GraphAnnotation, GraphConfiguration)
  .addNode("initialize", initialize)
  .addNode("generate-plan", generatePlan)
  .addNode("rewrite-plan", rewritePlan)
  .addNode("generate-action", generateAction)
  .addNode("take-action", takeAction)
  .addNode("summarize-session", summarizeSession)
  .addEdge(START, "initialize")
  .addEdge("initialize", "generate-plan")
  .addConditionalEdges("generate-plan", routeAfterPlan, [
    "generate-action",
    "rewrite-plan",
  ])
  .addConditionalEdges("rewrite-plan", routeAfterPlan, [
    "generate-action",
    "rewrite-plan",
  ])
  .addEdge("generate-plan", "generate-action")
  .addConditionalEdges("generate-action", takeActionOrEnd, ["take-action", END])
  .addConditionalEdges("take-action", generateActionOrSummarize, [
    "generate-action",
    "summarize-session",
  ])
  .addEdge("summarize-session", END);

export const graph = workflow.compile();
graph.name = "LangGraph ReAct MCP";
