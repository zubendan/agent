# Questions for the human

The loop adds a question when a decision is genuinely the human's to make, applies the recommended default, and keeps working. Answer a question by editing its `answer:` line. The next session reads it and follows your answer, even where that means undoing the default. The auditor moves answered questions to `agent/archive/QUESTIONS.md`.

Format:

```
## Q<nn> <short question>  (open | answered)
- context: <why it matters, task id>
- default applied: <what the loop did meanwhile>
- answer:
```
