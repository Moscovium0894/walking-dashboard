import { useEffect, useState } from "react";

// -----------------------------------------------------------------------------
// Analog ROLLING ODOMETER — black mechanical dials, period serif digits ticking
// over to the exact figure. The signature "View detailed" reveal. Big and
// high-contrast for older eyes.
// -----------------------------------------------------------------------------
// Each digit is a reel: a vertical strip of 0–9 that slides to show the target
// digit. Reels roll left-to-right with a slight stagger for a mechanical feel.

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

function Reel({ digit, delay }) {
  const [pos, setPos] = useState(0); // start showing 0, then roll to target
  useEffect(() => {
    // setTimeout (not rAF) so the value always settles, even in a backgrounded
    // tab where requestAnimationFrame is paused; the small delay still lets the
    // CSS transition play the rolling animation for a visible viewer.
    const id = setTimeout(() => setPos(digit), 80);
    return () => clearTimeout(id);
  }, [digit]);
  return (
    <span className="odo-reel">
      <span
        className="odo-strip"
        style={{ transform: `translateY(${-pos * 10}%)`, transitionDelay: `${delay}ms` }}
      >
        {DIGITS.map((d) => (
          <span className="odo-digit" key={d}>{d}</span>
        ))}
      </span>
    </span>
  );
}

export default function Odometer({ value, decimals = 0, suffix = "" }) {
  // Format with thousands separators and fixed decimals.
  const text = Number(value).toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  let digitIndex = 0;
  const digitCount = (text.match(/\d/g) || []).length;

  return (
    <div className="odometer" role="img" aria-label={`${text}${suffix}`}>
      {text.split("").map((ch, i) => {
        if (/\d/.test(ch)) {
          // stagger from the most-significant digit downwards
          const delay = (digitCount - 1 - digitIndex) * 90;
          digitIndex++;
          return <Reel key={i} digit={+ch} delay={delay} />;
        }
        return (
          <span className="odo-sep" key={i}>{ch}</span>
        );
      })}
      {suffix && <span className="odo-suffix">{suffix}</span>}
    </div>
  );
}
