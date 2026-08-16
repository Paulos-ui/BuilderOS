"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Six separate inputs rather than one text field.
 *
 * The behaviours that make this feel right, and that are easy to get wrong:
 *  - Pasting a full code into any box fills all six (people paste from
 *    their mail client, they don't retype).
 *  - Backspace on an empty box moves back and clears the previous one.
 *  - inputMode="numeric" brings up the number pad on mobile.
 *  - Submitting happens automatically once the sixth digit lands, so there
 *    is no redundant "confirm" tap.
 */
export default function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [focused, setFocused] = useState(0);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  function setDigit(index: number, digit: string) {
    const next = value.padEnd(6, " ").split("");
    next[index] = digit;
    const joined = next.join("").replace(/\s/g, "");
    onChange(joined);
    return joined;
  }

  function handleChange(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "");
    if (!cleaned) return;

    // A multi-character value means a paste — distribute it.
    if (cleaned.length > 1) {
      const filled = cleaned.slice(0, 6);
      onChange(filled);
      const target = Math.min(filled.length, 5);
      refs.current[target]?.focus();
      if (filled.length === 6) onComplete(filled);
      return;
    }

    const joined = setDigit(index, cleaned);
    if (index < 5) refs.current[index + 1]?.focus();
    if (joined.length === 6) onComplete(joined);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index].trim()) {
        setDigit(index, " ");
      } else if (index > 0) {
        setDigit(index - 1, " ");
        refs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      refs.current[index + 1]?.focus();
    }
  }

  return (
    <div
      className="flex justify-between gap-2"
      role="group"
      aria-label="Six-digit sign-in code"
    >
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          value={digit.trim()}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => {
            setFocused(i);
            e.target.select();
          }}
          className={`h-14 w-full min-w-0 rounded-sm border bg-ink/70 text-center font-mono text-xl text-paper transition-colors focus:outline-none disabled:opacity-50 ${
            invalid
              ? "border-danger/70"
              : focused === i
                ? "border-brass-bright"
                : "border-line/40"
          }`}
        />
      ))}
    </div>
  );
}
