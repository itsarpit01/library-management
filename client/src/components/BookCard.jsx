const SERVER_URL = "http://localhost:5000";

export default function BookCard({ book, actions }) {
  const available = book.availableCopies > 0;

  return (
    <div className="card book-card">
      <div className="book-cover">
        {book.coverImage ? (
          <img
            src={`${SERVER_URL}${book.coverImage}`}
            alt={book.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
          />
        ) : (
          <span>{book.title.charAt(0).toUpperCase()}</span>
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