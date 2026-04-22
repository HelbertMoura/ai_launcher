import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import "./Input.css";

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { prefix, suffix, invalid, className, ...rest },
  ref,
) {
  const wrapCls = ["cd-input"];
  if (invalid) wrapCls.push("cd-input--invalid");
  if (className) wrapCls.push(className);
  return (
    <label className={wrapCls.join(" ")}>
      {prefix && <span className="cd-input__prefix">{prefix}</span>}
      <input ref={ref} {...rest} />
      {suffix && <span className="cd-input__suffix">{suffix}</span>}
    </label>
  );
});
