export default function Home() {
  return (
    <div>
      <h1>Welcome to Pyra</h1>
      <p>This page was server-side rendered and hydrated on the client.</p>
      <nav>
        <a href="/about">About</a> | <a href="/blog/hello-world">Blog Post</a>
      </nav>
      <button onClick={() => alert("Hydration works!")}>Click me</button>
    </div>
  );
}
