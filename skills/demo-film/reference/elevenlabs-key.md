# The ElevenLabs key: one per person

Every person who films uses **their own** ElevenLabs account and key. A key is never
shared, committed, written into `config.json`, pasted into chat or printed. It lives only
in that person's macOS Keychain, under the service name `config.tts.keychainService`
(default `elevenlabs-api`). A teammate who clones a repo with demo files gets the voice
choice, not the key.

Why: the free tier is ~10 000 characters a month per account (about two 5-minute videos);
a shared key runs out for everyone at once, and a leaked key bills its owner.

## Ask for it before any work

Both `demo-setup` and `demo-film` do this first, before questions about the video, when
the provider is `elevenlabs` (the default):

1. Check without printing the secret:
   ```sh
   security find-generic-password -s elevenlabs-api >/dev/null 2>&1 && echo present || echo missing
   ```
2. `present` → confirm it works and show the quota:
   `node ${CLAUDE_SKILL_DIR}/scripts/tts.mjs <workDir> voices` (from demo-setup:
   `${CLAUDE_SKILL_DIR}/../demo-film/scripts/…`). An HTTP 401 means the key is wrong or revoked:
   treat it as missing.
3. `missing` → stop and tell the user, in their language:
   1. sign up or log in at https://elevenlabs.io (the free plan is enough);
   2. create a key at https://elevenlabs.io/app/settings/api-keys — "Create API key",
      any name; if the form offers per-feature permissions, enable **Text to Speech**
      and **Voices: read** (User: read is needed for the quota line);
   3. copy it, and run this **in their own terminal**, not in the chat:
      ```sh
      security add-generic-password -s elevenlabs-api -a "$USER" -U -w
      ```
      It prompts for the password twice with hidden input — paste the key both times.
   4. say "done" — then re-check from step 1.

   Offer the alternative in the same message: `tts.provider: "say"` needs no key (free,
   offline, robotic — fine for a draft).
4. If the user pastes a key into the chat anyway: do not use it, do not repeat it; tell
   them it is now in the conversation history, ask them to revoke it in ElevenLabs,
   create a new one and store it with the command above.

## Voices across accounts

A `tts.voiceId` committed in `config.json` works for everyone only if it is one of
ElevenLabs' **default** voices (e.g. Eric `cjVigY5qzO86Huf0OWal`). A voice from the Voice
Library or a cloned voice must be added to each person's own library first; otherwise
`tts.mjs all` fails with a 4xx for that voice — audition again on that account.

## Rotating or removing

```sh
security add-generic-password -s elevenlabs-api -a "$USER" -U -w   # -U replaces the old key
security delete-generic-password -s elevenlabs-api                  # remove it
```
