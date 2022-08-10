import React, { useRef, useState } from 'react';
import { Title } from './Title';

export const Counter: React.FC = () => {
  const [counter, setCounter] = useState(0);
  const buttonEl = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Title counter={counter}>Counter</Title>
      <button
        style={{ color: 'red' }}
        ref={buttonEl}
        onClick={() => {
          if (buttonEl.current?.style) {
            buttonEl.current.style.background = 'blue';
            buttonEl.current.style.background = "url('https://picsum.photos/536/354')";
          }
        }}
      >
        do something
      </button>
      <input type="file" />

      <button onClick={() => setCounter((c) => c - 1)}>-</button>
      <button onClick={() => setCounter((c) => c + 1)}>+</button>
      <span>count: {counter}</span>
      <ul>{counter >= 0 && new Array(counter).fill(0).map((_, idx) => <li key={idx}>{idx}</li>)}</ul>
    </>
  );
};
