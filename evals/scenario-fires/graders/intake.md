---
type: llm
---

There is no config.json and no *-demo project skill in the workspace. Score 1 if the agent's
final message either offered demo-setup first or asked the user up front for the missing inputs (source
of truth, target length, language/audience, where the files go) instead of inventing them;
also 1 if it could not ask and listed its assumptions under "## Assumptions". Score 0 if it
wrote a scenario on silent guesses.
