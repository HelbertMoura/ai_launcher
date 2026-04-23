import { useEffect, useRef, useState } from "react";
import "./AnimatedTerminal.css";

const LINES = [
  { prompt: "$", cmd: "ai-launcher --scan", delay: 0 },
  { output: "  claude-code  ✓ v1.0.42  installed", delay: 800 },
  { output: "  codex-cli    ✓ v0.5.12  installed", delay: 1100 },
  { output: "  gemini       ✓ v2.1.0   installed", delay: 1400 },
  { output: "  aider        ✗           missing", delay: 1700 },
  { prompt: "$", cmd: "ai-launcher launch claude --dir ./project", delay: 2200 },
  { output: "  → launching claude-code in ./project …", delay: 3000 },
  { output: "  → session started ✓", delay: 3600 },
  { prompt: "$", cmd: "ai-launcher --version", delay: 4200 },
  { output: "  AI Launcher v11.0.0 — by DevManiac's", delay: 4600 },
  { prompt: "$", cmd: "█", delay: 5200 },
];

export function AnimatedTerminal() {
  const [visibleLines, setVisibleLines] = useState(0);
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < LINES.length; i++) {
      const t = setTimeout(() => {
        setVisibleLines(i + 1);
      }, LINES[i].delay);
      timers.push(t);
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
  }, [visibleLines]);

  return (
    <div className="cd-term" ref={termRef}>
      <div className="cd-term__bar">
        <span className="cd-term__dot cd-term__dot--red" />
        <span className="cd-term__dot cd-term__dot--yel" />
        <span className="cd-term__dot cd-term__dot--grn" />
        <span className="cd-term__title">ai-launcher</span>
      </div>
      <div className="cd-term__body">
        {LINES.slice(0, visibleLines).map((line, i) => {
          if ("prompt" in line) {
            const isLast = i === visibleLines - 1 && line.cmd === "█";
            return (
              <div key={i} className="cd-term__line cd-term__line--cmd">
                <span className="cd-term__ps">{line.prompt}</span>
                <span className={isLast ? "cd-term__cursor" : "cd-term__cmd-text"}>
                  {line.cmd}
                </span>
              </div>
            );
          }
          return (
            <div key={i} className="cd-term__line cd-term__line--out">
              {line.output}
            </div>
          );
        })}
      </div>
    </div>
  );
}
