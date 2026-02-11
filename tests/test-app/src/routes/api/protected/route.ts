export async function GET(context) {
  return context.json({ message: "Protected data", routeId: context.routeId });
}
