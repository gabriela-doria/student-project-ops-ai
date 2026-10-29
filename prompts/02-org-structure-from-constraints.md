# 02 · Operating structure from constraints

**Use when:** a volunteer or student team keeps losing knowledge every year and everything depends on one or two people.

**Agent setup:** read access to the status brief (prompt 01) and past reports; write access to one new document.

---

```text
Design an operating structure for a university project. Base it on functions,
not on people, because people change every year.

Constraints (treat each one as a requirement you must answer):
- {{N_FACULTY_STABLE}} faculty member(s) with guaranteed continuity.
- {{N_FACULTY_UNCERTAIN}} faculty member(s) who may leave.
- New students every year; about {{ATTRITION}}% stop participating during the year.
- At most {{N_VETERANS}} students stay from one year to the next.
- Work happens in {{N_SITES}} physical sites and in cross-cutting work
  (communication, events, grants).
- The group wants partners and funding later.

Use the status brief as evidence for the current situation.

Deliver one document with:
1. A table: Constraint → How the structure answers it.
2. An org chart in Mermaid.
3. Roles: for each role, purpose, decisions it owns, recurring tasks, handover note.
4. Operating rules: meeting cadence, quorum, minutes format, where hours and
   accounts live. Each rule must fix a friction you found in the evidence.
5. A transition plan in three steps (now, pilot, next year).
6. What I should challenge: the 3 weakest assumptions in your own proposal.

Rules:
- No real names in the structure. Use role names.
- Do not invent numbers. If a target needs a number, propose it as a question.
- Keep it to what a student team can run with 2 hours a week of coordination.
```

---

**Why it is built this way**
- Writing constraints as requirements forces a traceable answer for each one (the table in step 1).
- "What I should challenge" makes the model critique its own proposal before a human does.
- The 2-hours-a-week limit keeps the output realistic for volunteers.
