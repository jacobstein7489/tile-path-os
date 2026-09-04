/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * A textarea with dictation. Speech only fills the box — the person still
 * reads it back before submitting, which is what makes phone entry fast
 * without being risky.
 */
export function VoiceField({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const rec = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSupported(
      Boolean((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition),
    );
    return () => rec.current?.stop?.();
  }, []);

  const toggle = () => {
    const Ctor = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening) {
      rec.current?.stop();
      setListening(false);
      return;
    }
    const r = new Ctor();
    r.lang = "en-US";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e: any) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i += 1) text += e.results[i][0].transcript;
      onChange(value ? `${value.trim()} ${text.trim()}` : text.trim());
    };
    r.onerror = () => {
      setListening(false);
      toast.error("Could not hear that — try again");
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
        {supported ? (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={listening}
            className={cn(
              "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold outline-none transition-colors duration-150",
              listening
                ? "border-danger/40 bg-danger-soft text-danger"
                : "border-border text-secondary-foreground hover:bg-muted",
            )}
          >
            {listening ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
            {listening ? "Stop" : "Speak"}
          </button>
        ) : null}
      </div>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[15px] leading-snug outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 md:text-[13.5px]"
      />
    </div>
  );
}
