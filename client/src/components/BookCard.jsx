const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
    : "http://localhost:5000");

export default function BookCard({ book, actions }) {
  const available = book.availableCopies > 0;

  const coverSrc = book.coverImage
    ? book.coverImage.startsWith("http")
      ? book.coverImage
      : `${SERVER_URL}${book.coverImage.startsWith("/") ? "" : "/"}${book.coverImage}`
    : null;

  return (
    <div className="card book-card">
      <div className="book-cover">
        {coverSrc ? (
          <img
            src={coverSrc}
            alt={book.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
          />
        ) : (
          <span>{book.title?.charAt(0)?.toUpperCase()}</span>
        )}
      </div>

      <div className="book-body">
        <h3 title={book.title}>{book.title}</h3>
        <p className="book-author">{book.author}</p>
        <div className="book-meta">
          {book.category && <span className="badge">{book.category}</span>}
          <span className={`badge ${available ? "badge-success" : "badge-danger"}`}>
            {available ? `${book.availableCopies}/${book.totalCopies} available` : "Not available"}
          </span>
        </div>
        <p className="book-isbn">ISBN {book.isbn}</p>
        <p className="book-price">₹{book.price}</p>
      </div>

      {actions && <div className="book-actions">{actions}</div>}
    </div>
  );
}