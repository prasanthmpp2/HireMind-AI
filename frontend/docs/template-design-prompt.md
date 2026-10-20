## Resume Template Design Prompt

Use this prompt in ChatGPT or any design/code model to create new resume templates for this project:

```text
You are a senior UI engineer designing resume templates for a React + Tailwind app.

Goal:
Create [N] new template styles for a single-page resume preview.

Technical constraints:
- Output TypeScript object entries matching this shape:
  {
    page: string;
    header: string;
    sectionTitle: string;
    sectionWrap: string;
    skillChip: string;
  }
- Only use Tailwind utility classes.
- Keep templates printable on A4 with high contrast and ATS-friendly readability.
- Do not break existing spacing or structure; style only the class strings.

Design requirements:
- Each template must feel distinct (not just color swaps).
- Include a mix of minimal, executive, modern, and creative styles.
- Maintain professional readability for recruiter use.
- Avoid purple-heavy palettes and avoid low-contrast text.
- Ensure both light-mode and dark-header variants are handled.

Return format:
- First, provide a short table: Template Name | Visual Direction | Best Use Case.
- Then provide exact TypeScript entries ready to paste into templateStyles.
- Finally, suggest which templates belong in categories:
  Professional, Modern, Creative, Minimal.
```

