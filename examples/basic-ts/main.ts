// Simple TypeScript counter example
// This file will be transformed on-the-fly by Pyra.js dev server

interface CounterState {
  count: number;
}

class Counter {
  private state: CounterState;
  private counterElement: HTMLElement;
  private buttonElement: HTMLButtonElement;

  constructor() {
    this.state = { count: 0 };

    this.counterElement = document.getElementById('counter')!;
    this.buttonElement = document.getElementById('increment') as HTMLButtonElement;

    this.buttonElement.addEventListener('click', () => this.increment());

    this.render();
  }

  increment(): void {
    this.state.count++;
    this.render();
  }

  render(): void {
    this.counterElement.textContent = this.state.count.toString();
  }
}

// Initialize the app
const counter = new Counter();

// Log to console to show TypeScript is working
console.log('🔥 Pyra.js dev server is working!');
console.log('TypeScript compiled successfully ✅');
