/**
 * Terminal-themed SVG illustrations for EmptyState variants.
 * All illustrations use currentColor so the parent can control tone via CSS.
 */

export function EmptyHistoryIllustration() {
  return (
    <svg
      width="160"
      height="100"
      viewBox="0 0 160 100"
      aria-hidden="true"
      className="empty-illustration"
    >
      {/* Terminal window frame */}
      <rect
        x="10"
        y="10"
        width="140"
        height="80"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.4"
      />
      {/* 3 traffic lights */}
      <circle cx="22" cy="22" r="2.5" fill="currentColor" opacity="0.35" />
      <circle cx="32" cy="22" r="2.5" fill="currentColor" opacity="0.35" />
      <circle cx="42" cy="22" r="2.5" fill="currentColor" opacity="0.35" />
      {/* Prompt line */}
      <text
        x="22"
        y="55"
        fill="currentColor"
        fontFamily="var(--ff-mono, monospace)"
        fontSize="12"
        opacity="0.7"
      >
        &gt; _
      </text>
      {/* Blinking cursor accent */}
      <rect x="38" y="47" width="7" height="11" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function EmptyPresetsIllustration() {
  return (
    <svg
      width="160"
      height="100"
      viewBox="0 0 160 100"
      aria-hidden="true"
      className="empty-illustration"
    >
      {/* Recipe card outline */}
      <rect
        x="30"
        y="18"
        width="100"
        height="64"
        rx="4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.4"
      />
      {/* Dashed lines suggesting content slots */}
      <line
        x1="40"
        y1="34"
        x2="110"
        y2="34"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.35"
      />
      <line
        x1="40"
        y1="46"
        x2="95"
        y2="46"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.35"
      />
      <line
        x1="40"
        y1="58"
        x2="100"
        y2="58"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity="0.35"
      />
      {/* + button */}
      <circle
        cx="120"
        cy="72"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.7"
      />
      <line
        x1="115"
        y1="72"
        x2="125"
        y2="72"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.8"
      />
      <line
        x1="120"
        y1="67"
        x2="120"
        y2="77"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.8"
      />
    </svg>
  );
}

export function EmptyCliIllustration() {
  return (
    <svg
      width="160"
      height="100"
      viewBox="0 0 160 100"
      aria-hidden="true"
      className="empty-illustration"
    >
      {/* Package box */}
      <path
        d="M40 30 L80 18 L120 30 L120 70 L80 82 L40 70 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.5"
      />
      <line x1="40" y1="30" x2="80" y2="42" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="120" y1="30" x2="80" y2="42" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <line x1="80" y1="42" x2="80" y2="82" stroke="currentColor" strokeWidth="1" opacity="0.4" />
      {/* Arrow → */}
      <line
        x1="130"
        y1="50"
        x2="150"
        y2="50"
        stroke="currentColor"
        strokeWidth="1.3"
        opacity="0.7"
      />
      <polyline
        points="145,45 150,50 145,55"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        opacity="0.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
