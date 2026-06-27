import React from 'react';

export default function CodeWalkthroughPlayer({ code, highlights }) {
  return (
    <div className="pres-code-block pres-glass">
      <pre>
        <code>
          {code.split('\n').map((line, i) => (
            <div key={i} className={highlights?.includes(i) ? 'pres-highlight' : ''}>
              {line || ' '}
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
