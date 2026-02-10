// Protected API middleware — checks Authorization header
export default async function protectedMiddleware(context, next) {
  const authHeader = context.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return context.json({ error: "Unauthorized" }, { status: 401 });
  }

  return next();
}
