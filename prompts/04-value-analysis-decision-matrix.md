# 04 · Value analysis: compare alternatives before changing a live system

**Use when:** there are several ways to change something people already use, and opinions are louder than criteria.

**Agent setup:** read access to the proposal, the quick guide and meeting notes; output as one interactive page. Scoring logic is reproduced in [`tools/decision_matrix.py`](../tools/decision_matrix.py).

---

```text
Act as a value-analysis facilitator (function analysis in the sense of
EN 12973, not earned value management).

Inputs: the current structure, {{N_ALTERNATIVES}} alternative structures,
and my notes from the last meeting.

1. Functions: list what the shared Drive must do, as verb + noun
   ("keep evidence for grant reports", "let a newcomer find files").
   Mark each as basic or secondary.
2. Criteria: up to 15, grouped. Write each as a yes/no test question.
   Mark 2 or 3 as vetoes (a negative score eliminates the option).
3. Two weight profiles that sum to 100: one for system-level folders
   (resilience first) and one for day-to-day folders (speed first).
4. Score every alternative from -2 to +2 on every criterion. One sentence
   of evidence per score. Apply vetoes first, then the weighted sum.
5. A change process with three tracks (fast, medium, structural), who
   decides each and how often.
6. Indicators to check after the change, each with how to measure it.
7. "What I would challenge": compare your result with my meeting notes and
   list principles I stated that your scoring ignored.

Do not choose for me. Show the ranking, the closest runner-up, and what
would have to be true for the runner-up to win.
```

---

**Why it is built this way**
- Vetoes stop a high total from hiding an unacceptable risk (for example, data exposure).
- Two weight profiles avoid one rule set for very different parts of the system.
- Step 7 checks the model's output against what the humans actually said.
