export default function BlogPost({ params }: { params: { slug: string } }) {
  return (
    <div>
      <h1>Blog: {params.slug}</h1>
      <p>You are reading the post with slug: <strong>{params.slug}</strong></p>
      <a href="/">Back to Home</a>
    </div>
  );
}
