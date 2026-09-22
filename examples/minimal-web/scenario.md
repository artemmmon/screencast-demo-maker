# Demo example-minimal-web — shooting script

~20 s. A smoke test for the plugin: one static page, browser only, the free macOS voice.

## Assumptions
- Narration in English, voice `say` / Samantha — no API key needed.
- Filmed on the first non-main display; with one display, park the pointer in a corner.

## Preconditions
- `python3 -m http.server 8765 -d site` running in this folder.

## 1. The list — 8 s
**Show:** Tiny Tasks, the "Today" list.
**Do:** point at the title, then at the two "done" labels.
**Say (s1-01):** "This is Tiny Tasks, a one-page to-do list we use to try the plugin out."
**Say (s1-02):** "Two of the three tasks for today are already marked as done."

## 2. Details — 8 s
**Show:** the same page.
**Do:** click Details; point at the summary it opens.
**Say (s2-01):** "The Details button opens a short summary under the list."
**Say (s2-02):** "It says the same thing the list shows: two of three done, filming is last."

## Coverage
| Claim | Scene | Cue |
|---|---|---|
| two of three tasks done | 1 | s1-02 |
| Details opens a summary | 2 | s2-01 |

## Unverified claims
- none
