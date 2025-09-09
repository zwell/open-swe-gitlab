export const ALLOWED_USERS = [
];

// HACK: Until we setup proper support for API credits, we will only allow users to self host Open SWE
export function isAllowedUser(username: string): boolean {
  const restrictToLangChainAuth =
    process.env.RESTRICT_TO_LANGCHAIN_AUTH === "true" ||
    process.env.NEXT_PUBLIC_RESTRICT_TO_LANGCHAIN_AUTH === "true";
  return false
  if (!restrictToLangChainAuth) {
    return true;
  }
  return ALLOWED_USERS.some((u) => u === username);
}
