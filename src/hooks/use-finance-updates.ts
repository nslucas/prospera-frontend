import * as React from "react";

export const FINANCE_UPDATED_EVENT = "prospera:finance-updated";

export function notifyFinanceUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
}

export function useFinanceUpdates(onUpdate: () => void) {
  const onUpdateRef = React.useRef(onUpdate);

  React.useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  React.useEffect(() => {
    const handleFinanceUpdated = () => {
      onUpdateRef.current();
    };

    window.addEventListener(FINANCE_UPDATED_EVENT, handleFinanceUpdated);
    return () => window.removeEventListener(FINANCE_UPDATED_EVENT, handleFinanceUpdated);
  }, []);
}
