import React, { useEffect, useState } from 'react';
import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle<{ fontSize: number }>`
  h1 {
    margin: 0;
    padding: 0;
    font-size: ${({ fontSize }) => fontSize}px;
    font-family: Open-Sans, Helvetica, Sans-Serif;
  }
`;

export const TickingText: React.FC<{ interval: number }> = ({ interval }) => {
  const [counter, setCounter] = useState(0);
  useEffect(() => {
    const handle = setInterval(() => setCounter((c) => c + 1), interval * 1000);
    return () => clearTimeout(handle);
  }, []);
  return (
    <div>
      <GlobalStyle fontSize={counter + 20} />
      hi there <h1>{counter}</h1>
      <input onInput={(e) => console.log((e.target as HTMLInputElement).value)} />
      <select value="lime" onChange={(e) => console.log((e.target as HTMLSelectElement).value)}>
        <option value="grapefruit">Grapefruit</option>
        <option value="lime">Lime</option>
        <option value="coconut">Coconut</option>
        <option value="mango">Mango</option>
      </select>
      <input type="checkbox" onInput={(e) => console.log((e.target as HTMLInputElement).checked)} />
    </div>
  );
};
