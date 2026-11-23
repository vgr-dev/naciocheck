# Progress: <Feature title>

Append-only. The builder adds one entry per step; never edit earlier entries.
The reviewer reads this but checks the real diff, not these claims.
At-a-glance status lives in the `## Status` checklist of `plan.md`; this file holds the evidence.

<!-- Entry format:

## YYYY-MM-DD - Step N: <title>
- **Status:** done | blocked | partial
- **Changed:** `path`, `path`
- **Verified:** `<command>` -> pass/fail (short result)
- **Commit:** uncommitted, proposed "<subject>" | <short hash>
- **Open issues:** none | <list>

Under `/implement-phase` the orchestrator, not the builder, writes this file. Its per-step entry
adds two fields:
- **Run by:** implement-phase (builder subagent, model <model>)
- **Proposed commit (builder):** the builder's full proposed message in a plain fenced block
(the `Commit:` line stays `uncommitted, proposed "<subject>"`)

The orchestrator also appends one entry per phase:

## YYYY-MM-DD - Phase N: <title>
- **Status:** done | partial | blocked
- **Steps:** per step: done / flagged / blocked
- **File check:** pass | <files outside any step's Files, and the step blamed>
- **Phase verify:** `<command>` -> pass/fail
- **Commit proposal:** <the groups and subjects proposed>
- **Open issues:** none | <list>

-->
