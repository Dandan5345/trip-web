import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { useI18n } from '../i18n/I18nProvider';
import './ui.css';

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  labelledBy?: string;
}

const FOCUSABLE =
  'a[href], button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * A modal that behaves: Escape closes it, focus starts inside and stays
 * inside, and the element that opened it gets focus back on close.
 */
export function Modal({ title, subtitle, onClose, children, footer }: ModalProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialogRef.current)?.focus();
    return () => returnFocusRef.current?.focus?.();
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  return (
    <div
      className="te-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="te-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <header className="te-modal__header">
          <div className="te-modal__title">
            {title}
            {subtitle ? <div className="te-modal__subtitle">{subtitle}</div> : null}
          </div>
          <button type="button" className="te-icon-button" onClick={onClose} aria-label={t('close')}>
            ✕
          </button>
        </header>
        <div className="te-modal__body">{children}</div>
        {footer ? <div className="te-modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
