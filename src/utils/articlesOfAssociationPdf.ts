import { jsPDF } from 'jspdf';

export interface ArticlesOfAssociationConfig {
  companyName: string;
  rcNumber: string;
  registeredAddress: string;
  supportEmail: string;
  shareCapital: string;
  directorName: string;
  directorEmail: string;
  coDirectorName?: string;
  adoptionDate: string;
}

export function generateArticlesOfAssociationPdf(config: ArticlesOfAssociationConfig): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = 24;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - 22) {
      doc.addPage();
      y = 24;
    }
  };

  const addCenteredTitle = (text: string, fontSize: number, style: 'bold' | 'normal' = 'bold', spacingAfter = 6) => {
    doc.setFont('times', style);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    ensureSpace(lines.length * (fontSize * 0.45) + spacingAfter);
    lines.forEach((line: string) => {
      doc.text(line, pageWidth / 2, y, { align: 'center' });
      y += fontSize * 0.45;
    });
    y += spacingAfter;
  };

  const addSectionHeading = (text: string) => {
    ensureSpace(14);
    y += 3;
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(text.toUpperCase(), margin, y);
    y += 2;
    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  const addClauseHeading = (text: string) => {
    ensureSpace(10);
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(25, 25, 25);
    doc.text(text, margin, y);
    y += 5.5;
  };

  const addParagraph = (text: string, indent = 0, spacingAfter = 4) => {
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(35, 35, 35);
    const lines = doc.splitTextToSize(text, maxWidth - indent);
    ensureSpace(lines.length * 4.8 + spacingAfter);
    lines.forEach((line: string) => {
      doc.text(line, margin + indent, y);
      y += 4.8;
    });
    y += spacingAfter;
  };

  // --- COVER / HEADER ---
  doc.setDrawColor(180, 130, 20);
  doc.setLineWidth(1);
  doc.rect(12, 12, pageWidth - 24, pageHeight - 24);
  doc.setDrawColor(60, 60, 60);
  doc.setLineWidth(0.3);
  doc.rect(14, 14, pageWidth - 28, pageHeight - 28);

  y = 32;
  addCenteredTitle('FEDERAL REPUBLIC OF NIGERIA', 12, 'bold', 3);
  addCenteredTitle('THE COMPANIES AND ALLIED MATTERS ACT (CAMA 2020)', 11, 'bold', 3);
  addCenteredTitle('PRIVATE COMPANY LIMITED BY SHARES', 10.5, 'normal', 10);

  addCenteredTitle('MEMORANDUM AND ARTICLES OF ASSOCIATION', 15, 'bold', 5);
  addCenteredTitle('OF', 11, 'normal', 4);
  addCenteredTitle(config.companyName.toUpperCase(), 15, 'bold', 6);

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  addCenteredTitle(`Registration Reference: ${config.rcNumber || 'CAC Filing'}`, 10, 'normal', 2);
  addCenteredTitle(`Registered Office: ${config.registeredAddress}`, 10, 'normal', 2);
  addCenteredTitle(`Official Corporate Email: ${config.supportEmail}`, 10, 'normal', 10);

  doc.setDrawColor(180, 130, 20);
  doc.setLineWidth(0.6);
  doc.line(margin + 20, y, pageWidth - margin - 20, y);
  y += 10;

  // --- PART I: MEMORANDUM OF ASSOCIATION ---
  addSectionHeading('Part I — Memorandum of Association');

  addClauseHeading('1. Name of the Company');
  addParagraph(`The name of the Company is "${config.companyName.toUpperCase()}".`);

  addClauseHeading('2. Registered Office');
  addParagraph(
    `The Registered Office of the Company will be situated in ${config.registeredAddress}, or such other location within the Federal Republic of Nigeria as the Board of Directors may from time to time determine.`
  );

  addClauseHeading('3. Objects of the Company');
  addParagraph('The objects for which the Company is established are:');
  addParagraph(
    '(a) To design, develop, operate, and maintain competitive skill-based esports wagering, tournament hosting, matchmaking, and digital entertainment platforms, including mobile and web applications.',
    5
  );
  addParagraph(
    '(b) To provide automated escrow holding, match outcome verification, referee dispute resolution, and secure peer-to-peer prize settlement infrastructure for verified participants.',
    5
  );
  addParagraph(
    '(c) To integrate and operate licensed third-party payment processing, identity verification (KYC/BVN/NIN), and instant bank disbursement rails in compliance with applicable financial regulations.',
    5
  );
  addParagraph(
    '(d) To enforce strict Anti-Money Laundering (AML), Know Your Customer (KYC), anti-fraud telemetry, and fair-play compliance systems across all user accounts and transactions.',
    5
  );
  addParagraph(
    '(e) To carry on any other lawful business, digital technology service, licensing, partnership, or commercial enterprise conducive to the attainment of the above objects.',
    5
  );

  addClauseHeading('4. Liability of Members');
  addParagraph('The Company is a Private Company Limited by Shares. The liability of the members is limited to the amount, if any, unpaid on the shares respectively held by them.');

  addClauseHeading('5. Share Capital');
  addParagraph(`The Authorized Share Capital of the Company is ${config.shareCapital}.`);

  // --- PART II: ARTICLES OF ASSOCIATION ---
  addSectionHeading('Part II — Articles of Association');

  addClauseHeading('Article 1 — Interpretation & Governing Law');
  addParagraph(
    'In these Articles, unless the context otherwise requires, "the Act" means the Companies and Allied Matters Act (CAMA) 2020 and any statutory modification thereof; "the Company" means ' +
      config.companyName.toUpperCase() +
      '; and "the Board" means the Board of Directors of the Company for the time being.'
  );

  addClauseHeading('Article 2 — Private Company Restrictions');
  addParagraph(
    'The Company is a private company and accordingly: (a) the right to transfer shares is restricted in the manner hereinafter prescribed; (b) the number of members of the Company (exclusive of persons who are in the employment of the Company) shall be limited to fifty (50); and (c) any invitation to the public to subscribe for any shares or debentures of the Company is strictly prohibited.'
  );

  addClauseHeading('Article 3 — Share Capital & Transfer of Shares');
  addParagraph(
    'Subject to the provisions of the Act, shares shall be under the control of the Directors who may allot or otherwise dispose of the same to such persons on such terms and conditions as they think fit. No transfer of shares shall be registered without the prior written resolution of the Board of Directors.'
  );

  addClauseHeading('Article 4 — General Meetings & Voting');
  addParagraph(
    'The Company shall in each year hold a General Meeting as its Annual General Meeting in accordance with the Act. Two members present in person or by proxy shall constitute a quorum for any General Meeting. Every member present shall have one vote per ordinary share held.'
  );

  addClauseHeading('Article 5 — Powers and Duties of Directors');
  addParagraph(
    `The business of the Company shall be managed by the Board of Directors, initially led by ${config.directorName}${config.coDirectorName ? ' and ' + config.coDirectorName : ''}. The Directors may exercise all such powers of the Company as are not required by the Act to be exercised by the Company in General Meeting, including opening corporate bank accounts, executing merchant agreements with payment processors (including Flutterwave and Paystack), and appointing compliance officers.`
  );

  addClauseHeading('Article 6 — Escrow Custody & Client Fund Segregation');
  addParagraph(
    'All user wallet deposits and active match stakes held in escrow by the Company shall be tracked transparently on the Company ledger and segregated from corporate commission revenue. Withdrawals shall only be disbursed to verified bank accounts matching the authenticated identity of the account holder.'
  );

  addClauseHeading('Article 7 — KYC, AML & Anti-Fraud Governance');
  addParagraph(
    'The Company shall maintain mandatory Know Your Customer (KYC) identity verification, including Bank Verification Number (BVN), National Identification Number (NIN), and live bank account name resolution before authorizing cash disbursements. The Board and Compliance Unit are empowered to freeze, investigate, or terminate accounts implicated in multi-accounting, match manipulation, or fraudulent activity.'
  );

  addClauseHeading('Article 8 — Accounts, Audit & Indemnity');
  addParagraph(
    'The Directors shall cause true and accurate books of account to be kept with respect to all sums of money received and expended by the Company, all escrow settlements, and platform fees collected. Every Director and Officer of the Company shall be indemnified out of the assets of the Company against any liability incurred in defending any proceedings in the lawful execution of their duties.'
  );

  addClauseHeading('Article 9 — Winding Up');
  addParagraph(
    'If the Company shall be wound up, after settling all user escrow liabilities and lawful creditors, the surplus assets shall be distributed among the members in proportion to the capital paid up on the shares held by them respectively.'
  );

  // --- SUBSCRIBER & SIGNATURE SECTION ---
  addSectionHeading('Subscription & Execution');
  addParagraph(
    `We, the undersigned persons whose names and addresses are subscribed below, are desirous of being formed into a Company in pursuance of this Memorandum and Articles of Association, and agree to take the number of shares in the capital of the Company set opposite our respective names.`
  );

  ensureSpace(55);
  y += 4;
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, maxWidth, 8, 'F');
  doc.rect(margin, y, maxWidth, 8, 'S');
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.text('Subscriber / Director Name & Email', margin + 3, y + 5.5);
  doc.text('Role & Address', margin + 72, y + 5.5);
  doc.text('Shares', margin + 122, y + 5.5);
  doc.text('Signature', margin + 145, y + 5.5);
  y += 8;

  // Row 1
  const rowHeight = 20;
  doc.rect(margin, y, maxWidth, rowHeight, 'S');
  doc.setFont('times', 'bold');
  doc.setFontSize(9.5);
  doc.text(config.directorName, margin + 3, y + 6);
  doc.setFont('times', 'normal');
  doc.setFontSize(8.5);
  doc.text(config.directorEmail || config.supportEmail, margin + 3, y + 11);
  doc.text('Managing Director', margin + 72, y + 6);
  const addrLines = doc.splitTextToSize(config.registeredAddress, 45);
  doc.text(addrLines.slice(0, 2), margin + 72, y + 11);
  doc.text(config.coDirectorName ? '500,000' : '1,000,000', margin + 122, y + 8);
  doc.line(margin + 144, y + 13, margin + maxWidth - 4, y + 13);
  y += rowHeight;

  if (config.coDirectorName && config.coDirectorName.trim()) {
    doc.rect(margin, y, maxWidth, rowHeight, 'S');
    doc.setFont('times', 'bold');
    doc.setFontSize(9.5);
    doc.text(config.coDirectorName.trim(), margin + 3, y + 6);
    doc.setFont('times', 'normal');
    doc.setFontSize(8.5);
    doc.text('Director / Co-Subscriber', margin + 72, y + 6);
    doc.text(addrLines.slice(0, 2), margin + 72, y + 11);
    doc.text('500,000', margin + 122, y + 8);
    doc.line(margin + 144, y + 13, margin + maxWidth - 4, y + 13);
    y += rowHeight;
  }

  y += 10;
  ensureSpace(16);
  doc.setFont('times', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Dated this ${config.adoptionDate}`, margin, y);
  y += 7;
  doc.text('Witness to the above signatures:  ________________________________________  (Name / Address / Signature)', margin, y);

  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('times', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `${config.companyName.toUpperCase()} — Memorandum & Articles of Association | Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 15,
      { align: 'center' }
    );
  }

  const safeFileName = `${config.companyName.trim().replace(/[^a-zA-Z0-9]+/g, '_')}_Articles_of_Association.pdf`;
  doc.save(safeFileName);
}
