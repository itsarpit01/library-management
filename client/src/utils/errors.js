export function getErrorMessage(err, fallback = "Something went wrong") {
  const data = err?.response?.data;
  const first = Array.isArray(data?.errors)
    ? data.errors[0]
    : data?.errors && Object.values(data.errors)[0];

  if (typeof first === "string") return first;
  return first?.message || data?.message || fallback;
}