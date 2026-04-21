import './styles/fonts.css';
import './styles/tokens.css';        // shared (families, scales, spacing, radius, motion)
import './styles/tokens-dark.css';   // dark (default + [data-theme="dark"])
import './styles/tokens-light.css';  // light (overrides when [data-theme="light"])
import './styles/motion.css';        // keyframes for tab transitions
import './styles.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
