// Backend ke errors ko { field: message } object mein badalta hai
export const getFieldErrors = (err) => {
  const errors = err?.response?.data?.errors;
  if (!errors) return {};
  if (Array.isArray(errors)) {
    return Object.fromEntries(errors.map((e) => [e.field, e.message]));
  }
  return errors;
};