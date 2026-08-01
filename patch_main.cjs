const fs = require('fs');
let content = fs.readFileSync('src/main.jsx', 'utf8');

if (!content.includes('import { registerSW } from')) {
    content = content.replace("import App from './App.jsx'", "import App from './App.jsx'\nimport { registerSW } from 'virtual:pwa-register'\n\n// Registra o Service Worker\nif ('serviceWorker' in navigator) {\n  registerSW({ immediate: true })\n}");
    fs.writeFileSync('src/main.jsx', content);
}
