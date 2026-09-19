import { HTMLAttributes, ReactNode } from "react";

export interface ModalProps {
  show: boolean;
  title?: string;
  onClose: () => void;
  children?: ReactNode;
}

function ModalRoot({ show, title, onClose, children }: ModalProps) {
  if (!show) return null;

  return (
    <>
      <div className="modal d-block" tabIndex={-1} role="dialog">
        <div className="modal-dialog" role="document">
          <div className="modal-content">
            {title && (
              <div className="modal-header">
                <h5 className="modal-title">{title}</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}

function Body({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["modal-body", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

function Footer({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={["modal-footer", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

export const Modal = Object.assign(ModalRoot, { Body, Footer });
