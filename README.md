# Nijam

Say what your project does, and Nijam checks every claim against the code.

You paste a public GitHub link and pitch the project out loud, the way you would to a judge. Nijam splits the pitch into claims, reads the repo at one commit, and gives each claim a verdict with the lines behind it. Nijam means truth in Telugu.

I built it because solo hackathon work ends with claims I have to check by hand before I submit. Spoken claims are the ones that reach judges, so that is what it checks.

## Verdicts

| Verdict | Meaning |
|---|---|
| Backed by code | Lines in a source file do what the claim says |
| Simulated | It appears to work, but the code fakes it |
| Not in the repo | Every source file was read and nothing does this |
| Not settled | The evidence does not decide it |

A language model reads the code and proposes a verdict. Code in `src/lib/gate.ts` then decides whether the proposal stands:

- A claim is dropped unless its words appear in the pitch.
- A citation counts only if the quoted lines exist in that file at that commit.
- Backed by code needs source lines. READMEs and tests are not enough.
- Not in the repo is refused when any source file went unread.
- Stated test counts are compared with a count taken from the code, with no model involved.

When the gate overrules the model, the report says so.

Each report also gives you a `WHAT-IS-REAL.md`, an honest rewrite of the pitch, and a SHA-256 receipt over the commit, the pitch and the verdicts. The browser can recompute that receipt.

## Limits

Nijam reads code and does not run it. It cannot prove that something is deployed or that a number was measured, and code it marks as backed can still have bugs. Pitches and repo excerpts go to a third-party language model, so it only accepts public repos.

## Run it

```bash
npm install
npm test
npm run dev
```

Set `LLM_API_KEY`, `LLM_MODEL` and `GITHUB_TOKEN` in `.env.local`. `npm run eval` scores the checker on a planted repo with hand-labelled answers in `eval/labelled.ts`.
