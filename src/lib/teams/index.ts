export type {
  GetTeamDisplayNameInput,
  TeamAliasEntry,
  TeamDataProvider,
  TeamLeagueTag,
} from "./types";

export { TEAM_ALIASES, countIdMappings, countNameFallbacks } from "./team-aliases";
export { normalizeTeamName } from "./normalize-team-name";
export {
  getTeamDisplayName,
  getMatchDisplayLabel,
  getDisplayTeamName,
  getDisplayMatchLabel,
} from "./get-team-display-name";
