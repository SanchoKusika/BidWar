import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './app/Root';
import { leaveMiniAppHost } from './app/web/siteHost';
import '@/shared/ui/tokens/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

if (!leaveMiniAppHost()) {
  createRoot(root).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
