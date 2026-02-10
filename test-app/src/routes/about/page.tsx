// Static prerendered page — no dynamic data, rendered at build time
export const prerender = true;

export default function About() {
  return (
    <div>
      <h1>About Pyra</h1>
      <p>Pyra is a full-stack framework that gets out of your way.</p>
      <a href="/">Back to Home</a>
    </div>
  );
}
