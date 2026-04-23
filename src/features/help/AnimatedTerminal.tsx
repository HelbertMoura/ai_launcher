import { useCallback, useEffect, useRef, useState } from "react";
import "./AnimatedTerminal.css";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PromptLine {
  kind: "prompt";
  command: string;
}

interface OutputLine {
  kind: "output";
  segments: Segment[];
}

type Segment = PlainSegment | SuccessSegment | ErrorSegment | DimSegment;

interface PlainSegment {
  type: "plain";
  text: string;
}

interface SuccessSegment {
  type: "ok";
  text: string;
}

interface ErrorSegment {
  type: "err";
  text: string;
}

interface DimSegment {
  type: "dim";
  text: string;
}

interface BlankLine {
  kind: "blank";
}

type TermLine = PromptLine | OutputLine | BlankLine;

/* ------------------------------------------------------------------ */
/*  Script — the 3 demo steps                                          */
/* ------------------------------------------------------------------ */

const p = (command: string): PromptLine => ({ kind: "prompt", command });
const blank = (): BlankLine => ({ kind: "blank" });

const ok = (text: string): SuccessSegment => ({ type: "ok", text });
const err = (text: string): ErrorSegment => ({ type: "err", text });
const dim = (text: string): DimSegment => ({ type: "dim", text });
const plain = (text: string): PlainSegment => ({ type: "plain", text });

const out = (...segments: Segment[]): OutputLine => ({
  kind: "output",
  segments,
});

interface Step {
  lines: TermLine[];
}

const STEPS: Step[] = [
  {
    lines: [
      p("ai-launcher --scan"),
      out(plain("▸ Scanning system for AI CLIs...")),
      out(ok("  ✓ "), plain("Claude Code v4.7       "), dim("[installed]")),
      out(ok("  ✓ "), plain("Gemini CLI v1.2         "), dim("[installed]")),
      out(ok("  ✓ "), plain("Codex CLI v1.0          "), dim("[installed]")),
      out(err("  ✗ "), plain("Aider                   "), dim("[not found]")),
      out(ok("  ✓ "), plain("Qwen CLI v0.9           "), dim("[installed]")),
      out(
        plain("5 CLIs detected · "),
        ok("4 online"),
        plain(" · "),
        err("1 missing"),
      ),
    ],
  },
  {
    lines: [
      p("ai-launcher --launch claude --dir ~/project"),
      out(plain("▸ Launching Claude Code...")),
      out(dim("  Working directory: ~/project")),
      out(dim("  Provider: anthropic (default)")),
      out(ok("✓ "), plain("Claude Code ready.")),
    ],
  },
  {
    lines: [
      p("ai-launcher --costs --today"),
      out(plain("Today's spend: "), ok("$3.42")),
      out(dim("  Claude Code   "), plain("$2.10  "), dim("(12 sessions)")),
      out(dim("  Gemini CLI    "), plain("$0.92  "), dim("(5 sessions)")),
      out(dim("  Codex CLI     "), plain("$0.40  "), dim("(3 sessions)")),
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Timing constants                                                   */
/* ------------------------------------------------------------------ */

const CHAR_TYPING_MS = 28;
const OUTPUT_LINE_MS = 55;
const STEP_GAP_MS = 800;
const PAUSE_BEFORE_LOOP_MS = 3500;
const INITIAL_DELAY_MS = 1200;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AnimatedTerminal() {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [renderedLines, setRenderedLines] = useState<TermLine[]>([]);
  const [typingCommand, setTypingCommand] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const cancelRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
      }
    });
  }, []);

  const typeCommand = useCallback(
    async (cmd: string): Promise<string> => {
      let typed = "";
      for (const ch of cmd) {
        if (cancelRef.current) return typed;
        typed += ch;
        setTypingCommand(typed);
        scrollToBottom();
        await new Promise<void>((resolve) => setTimeout(resolve, CHAR_TYPING_MS));
      }
      return typed;
    },
    [scrollToBottom],
  );

  const runAnimation = useCallback(async () => {
    await new Promise<void>((resolve) =>
      setTimeout(resolve, INITIAL_DELAY_MS),
    );

    for (const step of STEPS) {
      if (cancelRef.current) return;

      for (const line of step.lines) {
        if (cancelRef.current) return;

        if (line.kind === "prompt") {
          setIsTyping(true);
          setTypingCommand("");
          scrollToBottom();
          const typed = await typeCommand(line.command);
          if (cancelRef.current) return;
          setRenderedLines((prev) => [
            ...prev,
            { kind: "prompt", command: typed },
          ]);
          setTypingCommand("");
          setIsTyping(false);
          scrollToBottom();
          await new Promise<void>((resolve) =>
            setTimeout(resolve, STEP_GAP_MS),
          );
        } else if (line.kind === "blank") {
          setRenderedLines((prev) => [...prev, blank()]);
          scrollToBottom();
        } else {
          setRenderedLines((prev) => [...prev, line]);
          scrollToBottom();
          await new Promise<void>((resolve) =>
            setTimeout(resolve, OUTPUT_LINE_MS),
          );
        }
      }

      setRenderedLines((prev) => [...prev, blank()]);
      scrollToBottom();
    }

    setShowCursor(true);

    await new Promise<void>((resolve) =>
      setTimeout(resolve, PAUSE_BEFORE_LOOP_MS),
    );

    if (!cancelRef.current) {
      setRenderedLines([]);
      runAnimation();
    }
  }, [typeCommand, scrollToBottom]);

  useEffect(() => {
    cancelRef.current = false;
    runAnimation();
    return () => {
      cancelRef.current = true;
    };
  }, [runAnimation]);

  return (
    <div className="at">
      <div className="at__bar">
        <span className="at__dot at__dot--red" />
        <span className="at__dot at__dot--yel" />
        <span className="at__dot at__dot--grn" />
        <span className="at__title">ai-launcher</span>
      </div>
      <div className="at__body" ref={bodyRef}>
        {renderedLines.map((line, i) => {
          if (line.kind === "prompt") {
            return (
              <div key={i} className="at__line at__line--cmd">
                <span className="at__ps">$</span>
                <span className="at__cmd">{line.command}</span>
              </div>
            );
          }
          if (line.kind === "blank") {
            return <div key={i} className="at__line at__line--blank" />;
          }
          return (
            <div key={i} className="at__line at__line--out">
              {line.segments.map((seg, j) => {
                if (seg.type === "ok")
                  return (
                    <span key={j} className="at__ok">
                      {seg.text}
                    </span>
                  );
                if (seg.type === "err")
                  return (
                    <span key={j} className="at__err">
                      {seg.text}
                    </span>
                  );
                if (seg.type === "dim")
                  return (
                    <span key={j} className="at__dim">
                      {seg.text}
                    </span>
                  );
                return (
                  <span key={j} className="at__plain">
                    {seg.text}
                  </span>
                );
              })}
            </div>
          );
        })}
        {isTyping && (
          <div className="at__line at__line--cmd">
            <span className="at__ps">$</span>
            <span className="at__cmd">
              {typingCommand}
              <span className="at__typing-cursor" />
            </span>
          </div>
        )}
        {!isTyping && showCursor && renderedLines.length > 0 && (
          <div className="at__line at__line--cmd">
            <span className="at__ps">$</span>
            <span className="at__cursor" />
          </div>
        )}
      </div>
    </div>
  );
}
