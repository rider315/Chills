const fs = require('fs');
const path = require('path');

const files = [
  'client/src/components/EmailPreview.jsx',
  'client/src/components/FileUpload.jsx',
  'client/src/components/Modal.jsx',
  'client/src/components/ReplyPanel.jsx',
  'client/src/components/Toast.jsx',
  'client/src/pages/Applications.jsx',
  'client/src/pages/Emails.jsx',
  'client/src/pages/Settings.jsx',
  'client/src/pages/Setup.jsx',
];

files.forEach(file => {
  const p = path.join('C:/Users/jaats/Desktop/Chills', file);
  let content = fs.readFileSync(p, 'utf8');
  content = content.replace(/import '\.\/[^']+\.css';\r?\n/g, '');
  fs.writeFileSync(p, content);
});
console.log('Done');
