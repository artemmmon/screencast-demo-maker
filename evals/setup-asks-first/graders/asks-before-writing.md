---
type: llm
---

Score 1 only if the agent's final message asks the user (with
AskUserQuestion or a numbered question message) about at least three of: what the video is
for, which surfaces appear (browser / editor / terminal), app URLs, narration language,
voice provider (ElevenLabs or macOS say), displays, controls that must never be clicked,
where demo files go. Score 0 if it instead reports a config.json written with values the
user never confirmed.
