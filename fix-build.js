const fs = require('fs');
const path = require('path');

// Create the Sonner provider component
const sonnerProviderContent = `
'use client';

import { Toaster } from 'sonner';

export function SonnerProvider() {
  return <Toaster position="top-right" richColors closeButton />;
}
`;

// Create the directory if it doesn't exist
const providerDir = path.join(__dirname, 'app', 'providers');
if (!fs.existsSync(providerDir)) {
  fs.mkdirSync(providerDir, { recursive: true });
}

// Write the Sonner provider file
fs.writeFileSync(
  path.join(providerDir, 'SonnerProvider.tsx'),
  sonnerProviderContent
);

// Update the layout.tsx file to include the Sonner provider
const layoutPath = path.join(__dirname, 'app', 'layout.tsx');
let layoutContent = fs.readFileSync(layoutPath, 'utf8');

// Check if SonnerProvider is already imported
if (!layoutContent.includes('SonnerProvider')) {
  // Add the import
  layoutContent = layoutContent.replace(
    "import { ThemeProvider } from '@/app/providers/ThemeProvider';",
    "import { ThemeProvider } from '@/app/providers/ThemeProvider';\nimport { SonnerProvider } from '@/app/providers/SonnerProvider';"
  );

  // Add the provider to the layout
  layoutContent = layoutContent.replace(
    '<ThemeProvider>',
    '<ThemeProvider>\n        <SonnerProvider>'
  );

  layoutContent = layoutContent.replace(
    '</ThemeProvider>',
    '</SonnerProvider>\n      </ThemeProvider>'
  );

  // Write the updated layout file
  fs.writeFileSync(layoutPath, layoutContent);
}

console.log('Build fixes applied successfully!'); 