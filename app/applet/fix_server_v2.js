const fs = require('fs');
const path = '/app/applet/server.ts';
let code = fs.readFileSync(path, 'utf8');

// I will try to find the starting point of the bad block and the ending point
const start = code.indexOf("        message: `Payment verified via Session Reference & Flutterwave mail!");
const end = code.indexOf("  }});    }");

if (start !== -1 && end !== -1) {
  code = code.substring(0, start) + code.substring(end + "  }});    }".length);
  fs.writeFileSync(path, code);
  console.log('Fixed server.ts');
} else {
  console.log('Could not find bad block', {start, end});
}
