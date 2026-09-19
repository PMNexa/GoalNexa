import { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

function CardRoot({ className, children, ...rest }: CardProps) {
  return (
    <div className={["card", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

function Header({ className, children, ...rest }: CardProps) {
  return (
    <div className={["card-header", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

function Body({ className, children, ...rest }: CardProps) {
  return (
    <div className={["card-body", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

function Footer({ className, children, ...rest }: CardProps) {
  return (
    <div className={["card-footer", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </div>
  );
}

function Title({ className, children, ...rest }: CardProps) {
  return (
    <h5 className={["card-title", className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </h5>
  );
}

export const Card = Object.assign(CardRoot, { Header, Body, Footer, Title });
