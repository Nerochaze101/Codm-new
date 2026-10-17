const fs = require('fs');
const path = '/app/applet/server.ts';
let code = fs.readFileSync(path, 'utf8');

const problematicSnippet = `  } catch (err: any) {    res.status(500).json({ error: err.message || 'Failed to check deposit status' });  }
});        message:`;

const fix = `  } catch (err: any) {    res.status(500).json({ error: err.message || 'Failed to check deposit status' });  }
});

app.post('/api/deposits/verify', async (req, res) => {
  const { depositId, userId, sessionReference, bankName, accountNumber, accountName } = req.body;
  try {
    const depRes = await pool.query(\`SELECT * FROM deposit_requests WHERE id = \${escapeSql(depositId)}\`);
    if (depRes.rows.length === 0) {
      return res.status(404).json({ error: 'Deposit request not found' });
    }
    const dep = depRes.rows[0];
    if (dep.status === 'completed') {
      const user = await getUserFromDb(dep.user_id);
      return res.json({ success: true, message: 'Deposit already credited!', credited: true, newBalance: user?.balance || 0 });
    }

    // Save user bank details to profile if provided
    if (bankName || accountNumber || accountName) {
      await pool.query(\`
        UPDATE users 
        SET bank_name = COALESCE(\${escapeSql(bankName || null)}, bank_name),
            account_number = COALESCE(\${escapeSql(accountNumber || null)}, account_number),
            account_name = COALESCE(\${escapeSql(accountName || null)}, account_name)
        WHERE id = \${escapeSql(userId || dep.user_id)}
      \`);
    }

    // Trigger real-time Gmail sync to check Flutterwave mail
    try {
      await syncGmailEmails();
    } catch (syncErr: any) {
      console.warn('Real-time Gmail sync warning:', syncErr.message);
    }

    // Check admin_emails for matching session reference or payment reference or amount
    const cleanRef = sessionReference.trim();
    const emailsRes = await pool.query(\`
      SELECT * FROM admin_emails 
      WHERE (
        subject ILIKE '%' || \${escapeSql(cleanRef)} || '%'
        OR body ILIKE '%' || \${escapeSql(cleanRef)} || '%'
        OR body ILIKE '%' || \${escapeSql(dep.payment_reference)} || '%'
      )
    \`);
    message:`;

if (code.includes(problematicSnippet)) {
  code = code.replace(problematicSnippet, fix);
  fs.writeFileSync(path, code);
  console.log('Fixed server.ts');
} else {
  console.log('Problematic snippet not found');
}
