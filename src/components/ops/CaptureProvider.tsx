import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Capture } from "@/components/ops/Capture";

type CaptureTarget = { projectId?: string | null; projectName?: string | null };

const CaptureContext = createContext<{ open: (target?: CaptureTarget) => void }>({
  open: () => {},
});

/** Capture is global: one modal, opened from the sidebar, the phone nav or a project. */
export function CaptureProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<CaptureTarget | null>(null);

  const open = useCallback((next?: CaptureTarget) => setTarget(next ?? {}), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <CaptureContext.Provider value={value}>
      {children}
      <Capture
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        projectId={target?.projectId ?? null}
        projectName={target?.projectName ?? null}
      />
    </CaptureContext.Provider>
  );
}

export function useCapture() {
  return useContext(CaptureContext).open;
}
