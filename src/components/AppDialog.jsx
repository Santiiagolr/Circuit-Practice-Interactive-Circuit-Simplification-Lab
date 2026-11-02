import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function AppDialog({ title, children, onCancel, onConfirm, confirmLabel = 'Abandonar y continuar', cancelLabel = 'Continuar practicando' }) {
  const ref = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<dialog ref={ref} className="app-dialog" aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); onCancel(); }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const targets = [...event.currentTarget.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')];
    const first = targets[0], last = targets.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <h2 id={titleId}>{title}</h2><div id={descriptionId} className="dialog-content">{children}</div>
    <div className="dialog-actions"><button autoFocus onClick={onCancel}>{cancelLabel}</button>{onConfirm && <button className="primary" onClick={onConfirm}>{confirmLabel}</button>}</div>
  </dialog>, document.fullscreenElement || document.body);
}
