import { BookIcon, CheckIcon } from "./Icons";

export default function AuthLayout({ children }) {
  return (
    <div className="auth">
      <aside className="auth-brand">
        <div className="logo">
          <span className="logo-mark" style={{ background: "rgba(255,255,255,0.2)" }}>
            <BookIcon />
          </span>
          LibraryHub
        </div>

        <div>
          <h1>Manage your library, simply.</h1>
          <p>
            Books, issues, returns and purchase requests in one clean place.
          </p>
          <ul className="auth-points">
            <li><span className="dot"><CheckIcon size={16} /></span> Track issued and overdue books</li>
            <li><span className="dot"><CheckIcon size={16} /></span> Automatic fine calculation</li>
            <li><span className="dot"><CheckIcon size={16} /></span> Request new books to buy</li>
          </ul>
        </div>

        <small>© LibraryHub</small>
      </aside>

      <main className="auth-form-side">
        <div className="auth-form">{children}</div>
      </main>
    </div>
  );
}