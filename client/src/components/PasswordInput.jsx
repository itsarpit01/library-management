import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./Icons";

export default function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap">
      <input {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        className="icon-btn"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
      </button>
    </div>
  );
}