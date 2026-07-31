const fs = require('fs');
let code = fs.readFileSync('src/pages/Login.jsx', 'utf8');

// Remove the logo mobile section that was added previously
const regexToRemove = /\s*\{\/\* Logo Mobile \*\/\}\s*<div className="flex lg:hidden justify-center mb-8">[\s\S]*?<\/div>\s*<\/div>\s*/m;
code = code.replace(regexToRemove, '\n');

fs.writeFileSync('src/pages/Login.jsx', code);
