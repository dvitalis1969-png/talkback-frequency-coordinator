const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const target = `    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <link rel="stylesheet" href="/index.css">
  </head>`;

const replacement = `    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
    <link rel="stylesheet" href="/index.css">

    <!-- Google AdSense Script -->
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7006418729399354"
     crossorigin="anonymous"></script>
  </head>`;

html = html.replace(target, replacement);
fs.writeFileSync('index.html', html);
