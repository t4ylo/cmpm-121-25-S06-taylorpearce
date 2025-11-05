// ...existing code...
import exampleIconUrl from "./noun-paperclip-7598668-00449F.png";
import "./style.css";

// make window.__gameTimers typed for TS
declare global {
  interface Window {
    // use ReturnType<typeof setInterval> so this works with both browser and Node typings
    __gameTimers?: {
      decay: ReturnType<typeof setInterval>;
      setback: ReturnType<typeof setInterval>;
    } | null;
  }

  // also type on globalThis for environments that prefer it
  interface GlobalThis {
    __gameTimers?: {
      decay: ReturnType<typeof setInterval>;
      setback: ReturnType<typeof setInterval>;
    } | null;
  }
}

type Nullable<T> = T | null;
const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const template = (
  level: number,
  target: number,
  count: number,
  lives: number,
) => `
  <div class="app">
    <div class="card">
      <div class="header">
        <img src="${exampleIconUrl}" class="icon" alt="logo" />
        <div>
          <div class="title">Counter Quest — Hard Mode</div>
          <div class="subtitle">Progress decays over time. Reach the target before you run out of lives!</div>
        </div>
      </div>

      <div class="meta">
        <div class="level-badge">Level ${level}</div>
        <div class="target">Target: <strong id="target">${target}</strong></div>
        <div class="target">Lives: <strong id="lives">${lives}</strong></div>
      </div>

      <div class="counter">
        <div class="count-bubble" id="count">${count}</div>
      </div>

      <div class="progress" aria-hidden="true">
        <div class="progress-fill" id="progress" style="width: ${
  Math.min(100, (count / target) * 100)
}%"></div>
      </div>

      <div class="controls">
        <button id="inc" class="btn">Increment</button>
        <button id="reset" class="btn btn-ghost">Reset</button>
      </div>

      <div id="toast" class="toast" aria-live="polite"></div>
      <div class="footer">Press Space/Enter to increment • Watch out for decay and setbacks!</div>
    </div>
  </div>
`;

const el = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;
const setText = (id: string, text: string) => {
  const e = el<HTMLElement>(id);
  if (e) e.textContent = text;
};
const setWidth = (id: string, pct: number) => {
  const e = el<HTMLElement>(id);
  if (e) e.style.width = `${pct}%`;
};

type GameState = {
  level: number;
  target: number;
  count: number;
  locked: boolean;
  lives: number;
  decayMs: number;
  setbackChance: number;
  setbackMax: number;
};

let state: GameState = {
  level: 1,
  target: rand(8, 14),
  count: 0,
  locked: false,
  lives: 3,
  decayMs: 1400,
  setbackChance: 0.14,
  setbackMax: 3,
};

// keyboard handler reference so it can be removed
let onKeyDownHandler: ((e: KeyboardEvent) => void) | null = null;

function clearTimers(): void {
  const t = (globalThis as unknown as {
    __gameTimers?: { decay: number; setback: number } | null;
  }).__gameTimers;
  if (!t) return;
  // Use globalThis.clearInterval so TS resolves the correct overloads
  globalThis.clearInterval(t.decay as unknown as number);
  globalThis.clearInterval(t.setback as unknown as number);
  (globalThis as unknown as {
    __gameTimers?: { decay: number; setback: number } | null;
  }).__gameTimers = null;
}

function startTimers(): void {
  clearTimers();
  const decay = globalThis.setInterval(() => {
    if (state.locked) return;
    if (state.count > 0) {
      state.count = Math.max(0, state.count - 1);
      updateUI();
    } else {
      // if count already 0, penalize a life sometimes to keep pressure
      state.lives = Math.max(0, state.lives - 1);
      showToast(`Life lost! ${state.lives} left`);
      updateUI();
      if (state.lives <= 0) {
        showToast("💀 Game over — resetting...");
        setTimeout(resetGame, 900);
      }
    }
  }, state.decayMs);

  const setback = globalThis.setInterval(() => {
    if (state.locked) return;
    if (Math.random() < state.setbackChance) {
      const lose = rand(1, state.setbackMax);
      state.count = Math.max(0, state.count - lose);
      showToast(`Oh no! -${lose}`);
      updateUI();
    }
  }, 2500);

  (globalThis as unknown as {
    __gameTimers?: { decay: number; setback: number } | null;
  }).__gameTimers = {
    decay: decay as unknown as number,
    setback: setback as unknown as number,
  };
}

function render(): void {
  document.body.innerHTML = template(
    state.level,
    state.target,
    state.count,
    state.lives,
  );
  attachHandlers();
  startTimers();
}

function nextLevel(): void {
  state.level += 1;
  // make targets grow faster to increase difficulty
  state.target = rand(12 + state.level * 2, 18 + state.level * 4);
  state.count = 0;
  // slight difficulty ramp: faster decay and higher setback chance
  state.decayMs = Math.max(900, state.decayMs - 80);
  state.setbackChance = Math.min(0.35, state.setbackChance + 0.02);
  state.lives = Math.min(3 + Math.floor(state.level / 4), 5); // occasional bonus lives
  showToast(`Level up! Now level ${state.level}`);
  render();
}

function resetGame(): void {
  clearTimers();
  state = {
    level: 1,
    target: rand(8, 14),
    count: 0,
    locked: false,
    lives: 3,
    decayMs: 1400,
    setbackChance: 0.14,
    setbackMax: 3,
  };
  render();
}

function showToast(text: string, time = 1100): void {
  const t = el<HTMLDivElement>("toast");
  if (!t) return;
  t.textContent = text;
  t.classList.add("show");
  // store timeout on the element (safe cast)
  // ensure existing timeout is cleared (guard the stored value)
  const holder = t as unknown as { __timeout?: number };
  if (typeof holder.__timeout === "number") {
    try {
      globalThis.clearTimeout(holder.__timeout);
    } catch {
      /* ignore */
    }
  }
  holder.__timeout = globalThis.setTimeout(
    () => t.classList.remove("show"),
    time,
  );
}

function attachHandlers(): void {
  const incBtn = el<HTMLButtonElement>("inc");
  const resetBtn = el<HTMLButtonElement>("reset");
  if (incBtn) incBtn.addEventListener("click", handleInc);
  if (resetBtn) resetBtn.addEventListener("click", resetGame);

  // remove previous keyboard handler before adding a new one (prevents duplicates)
  if (onKeyDownHandler) {
    globalThis.removeEventListener("keydown", onKeyDownHandler);
  }
  onKeyDownHandler = (e: KeyboardEvent) => {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      handleInc();
    }
  };
  globalThis.addEventListener("keydown", onKeyDownHandler);
}

function handleInc(): void {
  if (state.locked) return;
  // small chance for a "misclick" that wastes a click on higher levels
  if (Math.random() < Math.min(0.08, state.level * 0.01)) {
    showToast("Misclick! wasted");
    // a misclick can also cost a little progress
    state.count = Math.max(0, state.count - 1);
    updateUI();
    return;
  }

  state.count += 1;
  updateUI();

  if (state.count >= state.target) {
    state.locked = true;
    celebrate();
    setTimeout(() => {
      state.locked = false;
      nextLevel();
    }, 900);
  }
}

function updateUI(): void {
  setText("count", String(state.count));
  setText("target", String(state.target));
  setText("lives", String(state.lives));
  setWidth("progress", Math.min(100, (state.count / state.target) * 100));
  const bubble = el<HTMLDivElement>("count");
  if (bubble) {
    bubble.classList.remove("pop");
    void bubble.offsetWidth;
    bubble.classList.add("pop");
  }
}

function celebrate(): void {
  showToast("🎉 Target reached!");
  const card = document.querySelector(".card");
  card?.classList.add("celebrate");
  setTimeout(() => card?.classList.remove("celebrate"), 800);
}

// start once DOM is ready — more robust when this script is loaded in different places
if (document.readyState === "loading") {
  globalThis.addEventListener("DOMContentLoaded", () => {
    try {
      render();
    } catch (err) {
      // show a visible error and avoid silent failures
      // eslint-disable-next-line no-console
      console.error("Render failed:", err);
      const body = document.body;
      if (body) body.textContent = "An error occurred while starting the app.";
    }
  });
} else {
  render();
}
// ...existing code...
