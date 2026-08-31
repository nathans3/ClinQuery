export type StarterSuggestion = {
  label: string;
  icon: "search" | "document" | "compare" | "table" | "chat";
};

export const STARTER_SUGGESTIONS: StarterSuggestion[] = [
  { label: "Summarize the documents", icon: "search" },
  { label: "What is the study population?", icon: "document" },
  { label: "What treatment was evaluated?", icon: "compare" },
  { label: "What were the main findings?", icon: "table" },
  { label: "What safety findings were reported?", icon: "chat" },
  { label: "What are the key takeaways?", icon: "search" },
];
