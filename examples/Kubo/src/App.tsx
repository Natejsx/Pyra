import { useState } from 'react';
import { Nav } from './components/Nav';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="container">
      <Nav />
      <h1>Welcome to Pyra.js + React!</h1>
      <p>Edit <code>src/App.tsx</code> and save to reload.</p>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  );
}

export default App;
