export async function GET() {
  // Student import was removed along with the academic structure it depended on.
  // This route remains as a protected API ping used by proxy tests.
  return new Response(null, { status: 200 });
}
