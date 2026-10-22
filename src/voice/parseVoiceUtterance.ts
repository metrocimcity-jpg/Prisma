export type VoiceCommand =
  | { type: "wake" }
  | { type: "sleep" }
  | { type: "back" }
  | { type: "reset" }
  | { type: "selectAll" }
  | { type: "select"; name: string }
  | { type: "filterClear" }
  | { type: "filter"; query: string }
  | { type: "filterPanel" };

/** Chrome often hears the name as "prism", "prism a", or "prizma". Longer forms come first. */
const WAKE_WORD = "(?:hey |ok |okay )?(?:prisma|prism a|priz ma|prizma|prisms|prism)";
const SLEEP_WORD = "(?:down|done|off|sleep|stop)";

export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Turns one spoken phrase into commands.
 * "Prisma" wakes. "Prisma down" sleeps and ignores anything else in that phrase.
 * A command can share the wake phrase: "Prisma back", "back Prisma".
 */
export function parseVoiceUtterance(transcript: string): VoiceCommand[] {
  let text = normalizeSpeech(transcript);
  if (!text) {
    return [];
  }
  if (new RegExp(`\\b${WAKE_WORD}\\s+${SLEEP_WORD}\\b`).test(text)) {
    return [{ type: "sleep" }];
  }

  const commands: VoiceCommand[] = [];
  if (new RegExp(`\\b${WAKE_WORD}\\b`).test(text)) {
    commands.push({ type: "wake" });
    text = text
      .replace(new RegExp(`\\b${WAKE_WORD}\\b`, "g"), " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  if (!text) {
    return commands;
  }

  const command = parseCommand(text);
  if (command) {
    commands.push(command);
  }
  return commands;
}

function parseCommand(text: string): VoiceCommand | null {
  const bare = text
    .replace(/^(?:please |can you |could you |would you |i want to |let me |now )+/, "")
    .trim();
  if (!bare) {
    return null;
  }

  if (/\bselect\b/.test(bare) && /\b(?:all|every|everything)\b/.test(bare)) {
    return { type: "selectAll" };
  }
  if (/^(?:all|every) cells?$/.test(bare) || bare === "everything") {
    return { type: "selectAll" };
  }

  const named = bare.match(/\bselect\s+(.+)$/);
  if (named) {
    const name = cleanName(named[1]);
    return name ? { type: "select", name } : { type: "selectAll" };
  }

  if (
    (/\b(?:clear|remove|reset|disable)\b/.test(bare) && /\bfilters?\b/.test(bare)) ||
    /^(?:no filters?|filters? off|show all files)$/.test(bare)
  ) {
    return { type: "filterClear" };
  }

  if (/^(?:reset|reset (?:the )?(?:view|map|zoom)|start over)$/.test(bare)) {
    return { type: "reset" };
  }

  if (/^(?:go back|back up|go up|back|up)$/.test(bare)) {
    return { type: "back" };
  }

  const filtered = bare.match(/^(?:filter|filters)(?:\s+(?:by|for|to|on))?\s+(.+)$/);
  if (filtered) {
    const query = cleanName(filtered[1]);
    return query ? { type: "filter", query } : { type: "filterPanel" };
  }
  if (/^(?:filter|filters|show filters|open filters|show the filters)$/.test(bare)) {
    return { type: "filterPanel" };
  }

  const shown = bare.match(/^(?:show|only|just)(?:\s+me)?\s+(.+)$/);
  if (shown) {
    const query = cleanName(shown[1]);
    if (!query || query === "filter" || query === "filters") {
      return { type: "filterPanel" };
    }
    return { type: "filter", query };
  }

  return null;
}

function cleanName(name: string): string {
  return name
    .replace(/^(?:the |a |an |all |only |just )+/, "")
    .replace(/^(?:cell |cells |group |folder |file )/, "")
    .replace(/(?: cell| cells| group| folder| file)$/, "")
    .trim();
}
