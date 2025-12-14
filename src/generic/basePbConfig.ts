import { ContentRating, SourceIntents, type ExtensionInfo } from "@paperback/types";

export const basePbConfig = {
  name: "",
  description: "",
  version: "1.0.0-alpha.1",
  icon: "",
  language: "",
  capabilities: [
    SourceIntents.CHAPTER_PROVIDING,
    SourceIntents.DISCOVER_SECIONS_PROVIDING,
    SourceIntents.SEARCH_RESULTS_PROVIDING,
    SourceIntents.SETTINGS_FORM_PROVIDING,
  ],
  badges: [
    {
      label: "Italian 🇮🇹",
      textColor: "#ffffff",
      backgroundColor: "#28eac2",
    },
  ],
  developers: [
    {
      name: "Catta1997",
      website: "https://github.com/Catta1997",
    },
  ],
  contentRating: "SAFE" as ContentRating,
} satisfies ExtensionInfo;
