import { ReactNode } from "react";

export interface AuthBoxLayoutProps {
  title: string;
  children?: ReactNode;
}

export function AuthBoxLayout({ title, children }: AuthBoxLayoutProps) {
  return (
    <div className="login-page d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <div className="login-box" style={{ width: "100%", maxWidth: 420 }}>
        <div className="card">
          <div className="card-body">
            <h3 className="text-center mb-4">{title}</h3>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
