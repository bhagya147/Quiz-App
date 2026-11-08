# Quizly

A timed, multiple-choice quiz app built with vanilla HTML, CSS, and JavaScript. No build tools or dependencies — just open `index.html` in a browser.

## Features

- **30 questions** across 5 categories: Science, History, Geography, Technology, and Arts & Literature
- **Random rounds** — 10 questions in "All", or 6 from a single category, shuffled every time
- **15-second timer** per question with a color-changing countdown bar
- **Instant feedback** with an explanation after every answer
- **Results screen** with score ring, stats, and a full answer review
- **Personal best** saved in `localStorage`
- **Keyboard support** — press `1`–`4` to answer, `Enter` to continue
- **Responsive and accessible** — works on mobile, respects reduced-motion, and uses semantic markup

## Run it

Open `index.html` directly, or serve the folder:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then visit `http://localhost:8000`.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Markup for the start, quiz, and result screens |
| `style.css` | Theme, layout, animations, and responsive styles |
| `questions.js` | Question bank and explanations |
| `script.js` | Quiz state, timer, scoring, rendering, and storage |

## Add questions

Append an object to `QUESTIONS` in `questions.js`:

```js
{
  category: "Science",
  question: "Your question?",
  options: ["Option A", "Option B", "Option C", "Option D"],
  answer: "Option B", // must match an option exactly
  explanation: "Why Option B is correct.",
}
```

New categories automatically appear as chips on the start screen.
