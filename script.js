(() => {
  "use strict";

  const QUESTIONS_PER_ROUND = 10;
  const SECONDS_PER_QUESTION = 15;
  const BEST_KEY = "quizly.bestScore";
  const LOW_TIME = 5;

  const els = {
    startScreen: document.getElementById("start-screen"),
    quizScreen: document.getElementById("quiz-screen"),
    resultScreen: document.getElementById("result-screen"),
    bestScore: document.getElementById("best-score"),
    chips: document.getElementById("category-chips"),
    startBtn: document.getElementById("start-btn"),
    questionCount: document.getElementById("question-count"),
    scoreLive: document.getElementById("score-live"),
    progressFill: document.getElementById("progress-fill"),
    timerFill: document.getElementById("timer-fill"),
    timerValue: document.getElementById("timer-value"),
    questionCategory: document.getElementById("question-category"),
    questionText: document.getElementById("question-text"),
    options: document.getElementById("options"),
    feedback: document.getElementById("feedback"),
    feedbackTitle: document.getElementById("feedback-title"),
    feedbackText: document.getElementById("feedback-text"),
    nextBtn: document.getElementById("next-btn"),
    scoreRing: document.getElementById("score-ring"),
    scorePercent: document.getElementById("score-percent"),
    scoreFraction: document.getElementById("score-fraction"),
    resultTitle: document.getElementById("result-title"),
    resultMessage: document.getElementById("result-message"),
    newBest: document.getElementById("new-best"),
    statCorrect: document.getElementById("stat-correct"),
    statWrong: document.getElementById("stat-wrong"),
    statBest: document.getElementById("stat-best"),
    review: document.getElementById("review"),
    againBtn: document.getElementById("again-btn"),
    homeBtn: document.getElementById("home-btn"),
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const categories = ["All", ...new Set(QUESTIONS.map((q) => q.category))];

  const state = {
    category: "All",
    questions: [],
    index: 0,
    score: 0,
    answers: [],
    locked: false,
    timerId: null,
    timeLeft: SECONDS_PER_QUESTION,
    lastTick: 0,
    best: readBest(),
  };

  /* ---------- Storage ---------- */

  function readBest() {
    try {
      const value = Number(localStorage.getItem(BEST_KEY));
      return Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch {
      /* Storage can be unavailable (private mode, file protocol restrictions). */
    }
  }

  /* ---------- Helpers ---------- */

  function shuffle(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function showScreen(screen) {
    [els.startScreen, els.quizScreen, els.resultScreen].forEach((el) => {
      el.classList.toggle("is-active", el === screen);
    });
  }

  function renderChips() {
    els.chips.innerHTML = "";

    categories.forEach((category) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.textContent = category;
      chip.setAttribute("aria-pressed", String(category === state.category));

      chip.addEventListener("click", () => {
        state.category = category;
        els.chips.querySelectorAll(".chip").forEach((other) => {
          other.setAttribute("aria-pressed", String(other === chip));
        });
      });

      els.chips.append(chip);
    });
  }

  function showBest() {
    if (state.best > 0) {
      els.bestScore.textContent = `Personal best · ${state.best}%`;
      els.bestScore.hidden = false;
    } else {
      els.bestScore.hidden = true;
    }
  }

  /* ---------- Quiz flow ---------- */

  function startQuiz() {
    const pool =
      state.category === "All"
        ? QUESTIONS
        : QUESTIONS.filter((q) => q.category === state.category);

    state.questions = shuffle(pool)
      .slice(0, Math.min(QUESTIONS_PER_ROUND, pool.length))
      .map((q) => ({ ...q, options: shuffle(q.options) }));

    state.index = 0;
    state.score = 0;
    state.answers = [];
    state.locked = false;

    showScreen(els.quizScreen);
    renderQuestion();
  }

  function renderQuestion() {
    const current = state.questions[state.index];
    const total = state.questions.length;

    state.locked = false;
    state.timeLeft = SECONDS_PER_QUESTION;

    els.questionCount.textContent = `Question ${state.index + 1} of ${total}`;
    els.scoreLive.textContent = `Score ${state.score}`;
    els.progressFill.style.width = `${(state.index / total) * 100}%`;
    els.questionCategory.textContent = current.category;
    els.questionText.textContent = current.question;

    els.options.innerHTML = "";
    current.options.forEach((option, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option";
      button.style.setProperty("--i", String(i));
      button.dataset.index = String(i);

      const key = document.createElement("span");
      key.className = "key";
      key.textContent = String(i + 1);

      const text = document.createElement("span");
      text.className = "option-text";
      text.textContent = option;

      button.append(key, text);
      button.addEventListener("click", () => selectOption(i));
      els.options.append(button);
    });

    els.feedback.hidden = true;
    els.feedback.className = "feedback";
    els.nextBtn.hidden = true;
    els.nextBtn.textContent = state.index === total - 1 ? "See results" : "Next question";

    if (!prefersReducedMotion) {
      els.questionText.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 300, easing: "ease-out" }
      );
    }

    startTimer();
  }

  function selectOption(selectedIndex) {
    if (state.locked) return;
    state.locked = true;
    stopTimer();

    const current = state.questions[state.index];
    const selectedText = current.options[selectedIndex];
    const isCorrect = selectedText === current.answer;

    markOptions(selectedIndex, current);
    finishAnswer({ isCorrect, selectedText, correctText: current.answer, timedOut: false });
  }

  function handleTimeout() {
    if (state.locked) return;
    state.locked = true;

    const current = state.questions[state.index];
    markOptions(null, current);
    finishAnswer({ isCorrect: false, selectedText: null, correctText: current.answer, timedOut: true });
  }

  function markOptions(selectedIndex, current) {
    const correctIndex = current.options.indexOf(current.answer);
    const buttons = els.options.querySelectorAll(".option");

    buttons.forEach((button, i) => {
      button.disabled = true;

      if (i === correctIndex) {
        button.classList.add("is-correct");
        button.querySelector(".key").textContent = "✓";
      } else if (i === selectedIndex) {
        button.classList.add("is-wrong");
        button.querySelector(".key").textContent = "✕";
      } else {
        button.classList.add("is-muted");
      }
    });
  }

  function finishAnswer({ isCorrect, selectedText, correctText, timedOut }) {
    const current = state.questions[state.index];

    state.answers.push({
      question: current.question,
      selected: selectedText,
      correct: correctText,
      explanation: current.explanation,
      isCorrect,
      timedOut,
    });

    if (isCorrect) {
      state.score += 1;
      els.scoreLive.textContent = `Score ${state.score}`;
    }

    els.feedback.className = `feedback ${isCorrect ? "is-correct" : "is-wrong"}`;
    els.feedbackTitle.textContent = timedOut ? "Time's up!" : isCorrect ? "Correct!" : "Not quite";

    let text = "";
    if (!isCorrect) text += `The correct answer is "${correctText}". `;
    text += current.explanation;
    els.feedbackText.textContent = text;
    els.feedback.hidden = false;

    els.progressFill.style.width = `${((state.index + 1) / state.questions.length) * 100}%`;
    els.nextBtn.hidden = false;
    els.nextBtn.focus({ preventScroll: true });
  }

  function nextQuestion() {
    if (!state.locked) return;

    state.index += 1;
    if (state.index >= state.questions.length) {
      finishQuiz();
      return;
    }

    renderQuestion();
  }

  /* ---------- Timer ---------- */

  function startTimer() {
    stopTimer();
    state.timeLeft = SECONDS_PER_QUESTION;
    state.lastTick = performance.now();
    updateTimerUI();

    state.timerId = window.setInterval(() => {
      const now = performance.now();
      state.timeLeft = Math.max(0, state.timeLeft - (now - state.lastTick) / 1000);
      state.lastTick = now;
      updateTimerUI();

      if (state.timeLeft <= 0) {
        stopTimer();
        handleTimeout();
      }
    }, 100);
  }

  function stopTimer() {
    if (state.timerId !== null) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function updateTimerUI() {
    const ratio = state.timeLeft / SECONDS_PER_QUESTION;
    const isLow = state.timeLeft <= LOW_TIME;

    els.timerFill.style.width = `${ratio * 100}%`;
    els.timerFill.classList.toggle("is-low", isLow);
    els.timerValue.textContent = `${Math.ceil(state.timeLeft)}s`;
    els.timerValue.classList.toggle("is-low", isLow);
  }

  /* ---------- Results ---------- */

  function finishQuiz() {
    stopTimer();

    const total = state.questions.length;
    const percent = Math.round((state.score / total) * 100);
    const previousBest = state.best;
    const isNewBest = percent > previousBest;

    if (isNewBest) {
      state.best = percent;
      saveBest(percent);
    }

    els.scoreRing.style.setProperty("--percent", String(percent));
    els.scorePercent.textContent = `${percent}%`;
    els.scoreFraction.textContent = `${state.score} / ${total}`;

    const copy = resultCopy(percent);
    els.resultTitle.textContent = copy.title;
    els.resultMessage.textContent = copy.message;
    els.newBest.hidden = !isNewBest;

    els.statCorrect.textContent = String(state.score);
    els.statWrong.textContent = String(total - state.score);
    els.statBest.textContent = `${state.best}%`;

    renderReview();
    showScreen(els.resultScreen);
    els.resultTitle.focus({ preventScroll: true });
  }

  function resultCopy(percent) {
    if (percent === 100) {
      return {
        title: "Perfect run!",
        message: "Flawless. You answered every single question correctly — impressive work.",
      };
    }
    if (percent >= 80) {
      return {
        title: "Excellent work!",
        message: "You really know your stuff. Just a couple between you and a perfect score.",
      };
    }
    if (percent >= 60) {
      return {
        title: "Nice going!",
        message: "A solid result. Review the ones you missed and you'll be unstoppable next round.",
      };
    }
    if (percent >= 40) {
      return {
        title: "Good effort!",
        message: "You're getting there. Check the explanations below, then give it another go.",
      };
    }
    return {
      title: "Keep practicing!",
      message: "Tough round — but every wrong answer below teaches you something new. Try again?",
    };
  }

  function renderReview() {
    els.review.innerHTML = "";

    const heading = document.createElement("h3");
    heading.className = "review-heading";
    heading.textContent = "Review your answers";
    els.review.append(heading);

    state.answers.forEach((answer) => {
      const item = document.createElement("div");
      item.className = `review-item ${answer.isCorrect ? "is-correct" : "is-wrong"}`;

      const header = document.createElement("div");
      header.className = "review-question";

      const icon = document.createElement("span");
      icon.className = "review-icon";
      icon.textContent = answer.isCorrect ? "✓" : "✕";
      icon.setAttribute("aria-hidden", "true");

      const question = document.createElement("span");
      question.textContent = answer.question;

      header.append(icon, question);
      item.append(header);

      const yours = document.createElement("p");
      if (answer.selected) {
        yours.className = `review-meta ${answer.isCorrect ? "is-correct-text" : "is-wrong-text"}`;
        yours.textContent = `Your answer: ${answer.selected}`;
      } else {
        yours.className = "review-meta is-wrong-text";
        yours.textContent = "No answer — time ran out";
      }
      item.append(yours);

      if (!answer.isCorrect) {
        const correct = document.createElement("p");
        correct.className = "review-meta is-correct-text";
        correct.textContent = `Correct answer: ${answer.correct}`;
        item.append(correct);

        if (answer.explanation) {
          const why = document.createElement("p");
          why.className = "review-why";
          why.textContent = answer.explanation;
          item.append(why);
        }
      }

      els.review.append(item);
    });
  }

  /* ---------- Events ---------- */

  els.startBtn.addEventListener("click", startQuiz);
  els.nextBtn.addEventListener("click", nextQuestion);
  els.againBtn.addEventListener("click", startQuiz);

  els.homeBtn.addEventListener("click", () => {
    stopTimer();
    showBest();
    showScreen(els.startScreen);
  });

  document.addEventListener("keydown", (event) => {
    if (!els.quizScreen.classList.contains("is-active") || state.locked) return;

    const number = Number(event.key);
    if (number >= 1 && number <= 4) {
      const buttons = els.options.querySelectorAll(".option");
      if (buttons[number - 1]) {
        event.preventDefault();
        selectOption(number - 1);
      }
    }
  });

  /* ---------- Init ---------- */

  renderChips();
  showBest();
})();
