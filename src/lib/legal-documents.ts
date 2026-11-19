// Legal documents shown during registration.
//
// TERMS_DOCUMENT mirrors the official PDF in `public/Terms and privacy/`
// (LANHS_Terms_and_Conditions.pdf) clause for clause: if that PDF is revised,
// update this file to match.
//
// PRIVACY_NOTICE is specific to this system and describes what the code
// actually collects and does. LANHS_Privacy_Notice.pdf in the same folder is
// reference material only — the modal text is not a copy of it.

export type LegalClause = {
  /** Clause marker, e.g. "1.1." or "A." or "1." */
  id: string;
  /** Optional bold lead-in, e.g. "Right to Be Informed". */
  title?: string;
  text: string;
};

export type LegalBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "clauses"; items: LegalClause[] }
  | { kind: "bullets"; items: string[] }
  | { kind: "groups"; items: { id: string; label: string; bullets: string[] }[] }
  | { kind: "details"; items: { label: string; value: string }[] };

export type LegalSection = {
  number: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalReference = {
  /** Source title, used as the link text when href is set. */
  text: string;
  href?: string;
};

export type LegalDocumentKey = "terms" | "privacy";

export type LegalDocument = {
  key: LegalDocumentKey;
  eyebrow: string;
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  sections: LegalSection[];
  outro: string[];
  references: { heading: string; items: LegalReference[] };
  footer: string[];
};

const documentFooter = [
  "LANHS – Student Records and Document Request Management System",
  "Luis Aguado National High School | Republic of the Philippines",
];

export const TERMS_DOCUMENT: LegalDocument = {
  key: "terms",
  eyebrow: "Luis Aguado National High School",
  title: "Terms and Conditions",
  effectiveDate: "November 18, 2026",
  lastUpdated: "November 18, 2026",
  sections: [
    {
      number: "1",
      title: "Eligibility and Account Registration",
      blocks: [
        {
          kind: "clauses",
          items: [
            { id: "1.1.", text: "The LANHS DRMS is intended for currently enrolled students and former students or alumni of Luis Aguado National High School." },
            { id: "1.2.", text: "Users must provide accurate, complete, and truthful information when creating an account." },
            { id: "1.3.", text: "All newly registered accounts are subject to identity verification and approval by authorized school registrar personnel." },
            { id: "1.4.", text: "Registration does not automatically grant access to the system's services. Account activation is subject to successful verification and approval." },
            { id: "1.5.", text: "Users must not impersonate another individual, submit false identities, or create accounts using another person's personal information without proper authorization." },
            { id: "1.6.", text: "The school administration reserves the right to reject or suspend accounts containing inaccurate, misleading, or fraudulent information, subject to applicable policies and procedures." },
          ],
        },
      ],
    },
    {
      number: "2",
      title: "Account Security and Responsibilities",
      blocks: [
        {
          kind: "clauses",
          items: [
            { id: "2.1.", text: "Users are responsible for maintaining the confidentiality of their account credentials, including their passwords." },
            { id: "2.2.", text: "Users must not share their login credentials or permit unauthorized individuals to access their accounts." },
            { id: "2.3.", text: "Users are responsible for activities performed through their accounts and must promptly report suspected unauthorized access to the school administration." },
            { id: "2.4.", text: "Users must not attempt to access another user's account, academic records, or restricted system resources without proper authorization." },
          ],
        },
      ],
    },
    {
      number: "3",
      title: "Document Request Services",
      blocks: [
        {
          kind: "clauses",
          items: [
            { id: "3.1.", text: "The system provides an online facility for submitting requests for available school documents, including certificates, clearances, academic records, and other authorized registrar services." },
            { id: "3.2.", text: "All document requests are subject to verification, evaluation, and approval by authorized registrar personnel." },
            { id: "3.3.", text: "Submission of a document request does not guarantee its immediate approval or issuance." },
            { id: "3.4.", text: "Users must provide accurate information and any required supporting documents necessary to process their requests." },
            { id: "3.5.", text: "Users may monitor the progress of their requests through the system using the assigned request tracking information." },
            { id: "3.6.", text: "The registrar may request additional information or supporting documents when necessary to verify the identity of the requester or the legitimacy of the request." },
            { id: "3.7.", text: "The issuance of official school documents remains under the authority and discretion of the authorized school personnel, in accordance with applicable school policies and regulations." },
          ],
        },
      ],
    },
    {
      number: "4",
      title: "Accuracy and Authenticity of Information",
      blocks: [
        {
          kind: "clauses",
          items: [
            { id: "4.1.", text: "Users are responsible for ensuring that all information submitted through the system is accurate and truthful." },
            { id: "4.2.", text: "Users must not upload falsified documents, manipulate academic information, or attempt to alter official student records." },
            { id: "4.3.", text: "Any discovered fraudulent activity, unauthorized modification, or misuse of academic records may result in account suspension and referral to the appropriate school authorities." },
            { id: "4.4.", text: "The school reserves the right to verify submitted information against its official student records before processing document requests." },
          ],
        },
      ],
    },
    {
      number: "5",
      title: "Privacy and Protection of Personal Information",
      blocks: [
        {
          kind: "clauses",
          items: [
            { id: "5.1.", text: "The system collects and processes personal information for legitimate educational and administrative purposes, including account registration, identity verification, student record management, and document request processing." },
            { id: "5.2.", text: "Personal information shall be processed in accordance with Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012, its Implementing Rules and Regulations, and other applicable Philippine data protection requirements." },
            { id: "5.3.", text: "Access to personal and academic records shall be restricted to authorized personnel who have legitimate administrative responsibilities." },
            { id: "5.4.", text: "Personal information shall not be disclosed to unauthorized individuals or third parties, except when permitted or required by applicable laws and regulations." },
            { id: "5.5.", text: "Users acknowledge that their information may be electronically stored and processed to support the operation and delivery of the system's services." },
            { id: "5.6.", text: "The school shall implement appropriate organizational, physical, and technical safeguards to protect personal information against unauthorized access, disclosure, alteration, loss, or destruction." },
            { id: "5.7.", text: "Users are encouraged to review the system's Privacy Notice for further information regarding the collection, processing, storage, retention, and protection of their personal information." },
          ],
        },
      ],
    },
    {
      number: "6",
      title: "Electronic Documents and QR Code Verification",
      blocks: [
        {
          kind: "clauses",
          items: [
            { id: "6.1.", text: "Documents generated through the system may contain QR codes that allow authorized individuals to verify document authenticity through the designated online verification page." },
            { id: "6.2.", text: "QR codes and verification links must not be manipulated, misused, or reproduced for fraudulent purposes." },
            { id: "6.3.", text: "The verification feature is intended to support the authentication of documents issued through the system." },
            { id: "6.4.", text: "Users must not attempt to compromise, manipulate, or interfere with the document verification mechanism." },
            { id: "6.5.", text: "The presence of a QR code does not replace the official authority of the school registrar in validating and issuing school documents." },
          ],
        },
      ],
    },
    {
      number: "7",
      title: "System Audit Trails and Record Integrity",
      blocks: [
        {
          kind: "clauses",
          items: [
            { id: "7.1.", text: "The system may maintain audit logs of significant activities, including account-related actions, document requests, status updates, and administrative transactions." },
            { id: "7.2.", text: "Certain audit records may be secured through cryptographic hashing and blockchain-based verification mechanisms to support record integrity and tamper detection." },
            { id: "7.3.", text: "These mechanisms are intended to provide additional accountability and verification of recorded system activities." },
            { id: "7.4.", text: "Users must not attempt to manipulate, delete, falsify, or interfere with system audit records or their associated verification mechanisms." },
            { id: "7.5.", text: "Audit trails do not replace official school records or administrative approval procedures." },
          ],
        },
      ],
    },
    {
      number: "8",
      title: "Prohibited Activities",
      blocks: [
        { kind: "paragraph", text: "Users are strictly prohibited from performing the following activities:" },
        {
          kind: "bullets",
          items: [
            "Accessing accounts, academic records, or restricted information without authorization.",
            "Attempting to bypass authentication or identity verification mechanisms.",
            "Submitting falsified information or fraudulent supporting documents.",
            "Modifying, deleting, or manipulating official records without proper authorization.",
            "Exploiting system vulnerabilities or disrupting system operations.",
            "Using the platform to impersonate another individual.",
            "Distributing confidential student information without proper authorization.",
            "Using the system for unlawful, fraudulent, or unauthorized purposes.",
          ],
        },
        {
          kind: "paragraph",
          text: "Violations may result in account suspension, restriction of access, or referral to the appropriate school authorities, subject to applicable policies and laws.",
        },
      ],
    },
    {
      number: "9",
      title: "System Availability and Limitations",
      blocks: [
        {
          kind: "clauses",
          items: [
            { id: "9.1.", text: "The system is provided to facilitate school administrative services and improve the accessibility of document request procedures." },
            { id: "9.2.", text: "Temporary service interruptions may occur due to system maintenance, technical issues, internet connectivity problems, or circumstances beyond the school's control." },
            { id: "9.3.", text: "The school and its authorized administrators shall make reasonable efforts to maintain system availability, security, and reliability." },
            { id: "9.4.", text: "The system does not replace the official functions, responsibilities, and authority of the school registrar." },
            { id: "9.5.", text: "Users acknowledge that certain requests may require additional processing time depending on the availability of records, verification requirements, and administrative procedures." },
          ],
        },
      ],
    },
    {
      number: "10",
      title: "Amendments and Updates",
      blocks: [
        {
          kind: "clauses",
          items: [
            { id: "10.1.", text: "These Terms and Conditions may be revised or updated when necessary to reflect changes in system functionality, administrative procedures, or applicable laws and regulations." },
            { id: "10.2.", text: "Significant changes shall be communicated through appropriate system announcements or other official communication channels." },
            { id: "10.3.", text: "Continued use of the system following the implementation of updated terms shall be subject to the applicable acceptance requirements." },
          ],
        },
      ],
    },
    {
      number: "11",
      title: "Applicable Laws",
      blocks: [
        {
          kind: "paragraph",
          text: "These Terms and Conditions shall be interpreted and implemented in accordance with the applicable laws and regulations of the Republic of the Philippines, including Republic Act No. 10173, or the Data Privacy Act of 2012, and relevant Department of Education policies.",
        },
      ],
    },
    {
      number: "12",
      title: "Acceptance and Agreement",
      blocks: [
        { kind: "paragraph", text: "By checking the agreement box during registration, you acknowledge and confirm that:" },
        {
          kind: "bullets",
          items: [
            "You have read and understood these Terms and Conditions.",
            "You agree to comply with the rules, responsibilities, and restrictions stated herein.",
            "You understand that your account is subject to identity verification and approval by authorized school personnel.",
            "You agree to use the system only for legitimate educational and administrative purposes.",
            "You acknowledge that your personal information will be processed in accordance with the system's Privacy Notice and applicable Philippine data privacy laws.",
          ],
        },
      ],
    },
  ],
  outro: [
    "If you do not agree with these Terms and Conditions, you should not proceed with account registration or use the system.",
    "For questions or concerns regarding these Terms and Conditions, please contact the authorized school administration or registrar.",
  ],
  references: {
    heading: "Legal References",
    items: [
      { text: "Republic Act No. 10173 – Data Privacy Act of 2012.", href: "https://privacy.gov.ph/data-privacy-act/" },
      { text: "Implementing Rules and Regulations of RA 10173.", href: "https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/" },
      { text: "Applicable Department of Education policies and regulations.", href: "https://www.deped.gov.ph/about-deped/data-privacy-notice/" },
    ],
  },
  footer: documentFooter,
};

export const PRIVACY_NOTICE: LegalDocument = {
  key: "privacy",
  eyebrow: "Luis Aguado National High School",
  title: "Privacy Notice",
  effectiveDate: "November 18, 2026",
  lastUpdated: "November 18, 2026",
  sections: [
    {
      number: "1",
      title: "Information We Collect",
      blocks: [
        {
          kind: "paragraph",
          text: "To provide account registration, identity verification, student records management, and document request services, the system collects and processes the following categories of personal information:",
        },
        {
          kind: "groups",
          items: [
            {
              id: "A.",
              label: "Registration and identity details",
              bullets: [
                "Full name (first, middle, last, and suffix)",
                "Learner Reference Number (LRN)",
                "Email address",
                "Password (stored only as an irreversible hash)",
                "Phone number (optional)",
                "City, barangay, and house/street address",
                "Last school year attended",
                "Account role and registration status",
              ],
            },
            {
              id: "B.",
              label: "School records and document requests",
              bullets: [
                "Your student records maintained by the school",
                "The type of document requested and the details you submit with it",
                "Request tracking number, status, and processing history",
                "Certificates, clearances, and other documents generated for you",
              ],
            },
            {
              id: "C.",
              label: "System and activity information",
              bullets: [
                "Login and authentication activity",
                "Action and administrative activity logs",
                "Request submission and processing timestamps",
                "IP address and browser details recorded for security",
                "Security-related events",
              ],
            },
          ],
        },
        {
          kind: "paragraph",
          text: "The system collects only information that is necessary and proportionate to these purposes.",
        },
      ],
    },
    {
      number: "2",
      title: "Purpose of Collection and Processing",
      blocks: [
        {
          kind: "clauses",
          items: [
            { id: "1.", title: "Account registration and management", text: "To create, maintain, and manage your account." },
            { id: "2.", title: "Identity verification", text: "To verify your identity and eligibility through authorized registrar personnel." },
            { id: "3.", title: "Document request processing", text: "To receive, evaluate, approve, and generate the school documents you request." },
            { id: "4.", title: "Request tracking", text: "To track your requests and notify you of status changes." },
            { id: "5.", title: "System security", text: "To protect the system against unauthorized access, fraud, and misuse." },
            { id: "6.", title: "Legal and administrative compliance", text: "To meet applicable legal, Department of Education, and school administrative obligations." },
          ],
        },
      ],
    },
    {
      number: "3",
      title: "How Your Information Is Processed",
      blocks: [
        {
          kind: "paragraph",
          text: "You submit your details and document requests through the system's forms. The system stores them in its database and makes them available only to the personnel assigned to handle them.",
        },
        {
          kind: "paragraph",
          text: "Registrar and administrative personnel review, verify, and act on your registration and requests. Every significant action is recorded together with the time it was taken and the role of the person who took it.",
        },
        {
          kind: "paragraph",
          text: "Where needed, the system sends service emails about your account or request status. Processing is limited to what is necessary for the purposes in Section 2.",
        },
      ],
    },
    {
      number: "4",
      title: "Data Sharing and Disclosure",
      blocks: [
        { kind: "paragraph", text: "Your information is shared only with the following:" },
        {
          kind: "bullets",
          items: [
            "Authorized school personnel – registrar and administrative staff who need your information to perform their duties, under role-based permissions and on a need-to-know basis.",
            "Service providers – the infrastructure operators running the system's database, hosting, and email delivery, who process information only to provide those services.",
            "Document verification – the public verification page discloses only what is needed to confirm that a document was issued through the system and is valid.",
          ],
        },
        {
          kind: "paragraph",
          text: "Your information is never sold. It is disclosed to others only when required or permitted by applicable laws, a lawful order, or your consent.",
        },
      ],
    },
    {
      number: "5",
      title: "Data Storage and Retention",
      blocks: [
        {
          kind: "paragraph",
          text: "Your information is stored in the system's database and its hosting infrastructure. Documents issued to you are generated and delivered through the system rather than kept as separate file copies.",
        },
        {
          kind: "paragraph",
          text: "Your information is retained only for as long as necessary to fulfill the purposes in this notice, to comply with applicable legal obligations, and in line with Department of Education records-retention schedules and approved school records-management practices.",
        },
        {
          kind: "paragraph",
          text: "When your information is no longer needed and its retention is not required by law or legitimate archival obligations, it is securely disposed of or anonymized.",
        },
        {
          kind: "paragraph",
          text: "Cryptographic hashes recorded on a blockchain may not be practically removable, as described in Section 7.",
        },
      ],
    },
    {
      number: "6",
      title: "Security Measures",
      blocks: [
        {
          kind: "bullets",
          items: [
            "Passwords are stored only as salted bcrypt hashes and are never kept in plain text.",
            "Session cookies are HTTP-only and SameSite, are transmitted over encrypted connections in production, and can be revoked server-side.",
            "Login and registration attempts are rate limited to slow down abuse.",
            "Access to student records is restricted through role-based permissions for authorized personnel.",
            "Significant actions are recorded in audit logs, including the IP address and browser used.",
            "Documents and verification links are handled securely, and the system receives ongoing maintenance and security improvements.",
          ],
        },
        {
          kind: "paragraph",
          text: "The school and its authorized personnel take reasonable measures to maintain the confidentiality, integrity, and availability of the information processed through the system.",
        },
      ],
    },
    {
      number: "7",
      title: "Blockchain-Based Verification",
      blocks: [
        {
          kind: "paragraph",
          text: "The system records audit information about significant activities, such as account actions, document requests, status changes, and issued documents.",
        },
        {
          kind: "paragraph",
          text: "For each recorded entry, a SHA-256 cryptographic hash is computed from the record's identifier, the action taken, the role of the person who acted, the timestamp, and the hash of the previous record. This hash is submitted to a smart contract on a blockchain network (the Sepolia network when configured).",
        },
        {
          kind: "paragraph",
          text: "This creates a tamper-evident chain of records: if any entry were altered after it was recorded, its hash would no longer match, and the difference would be detectable when a document is verified.",
        },
        {
          kind: "paragraph",
          text: "No names, grades, or other personal information are written to the blockchain – only hashes and technical metadata such as the action, role, and timestamp. Because a hash can still be associated with an identifiable person, these records are assessed and handled under the Data Privacy Act of 2012.",
        },
      ],
    },
    {
      number: "8",
      title: "Your Rights as a Data Subject",
      blocks: [
        {
          kind: "paragraph",
          text: "Under the Data Privacy Act of 2012, you have the following rights, subject to applicable legal conditions and limitations:",
        },
        {
          kind: "clauses",
          items: [
            { id: "A.", title: "Right to Be Informed", text: "You have the right to know how and why your personal information is collected, processed, stored, and used." },
            { id: "B.", title: "Right to Access", text: "You have the right to request reasonable access to your personal information being processed by the responsible personal information controller." },
            { id: "C.", title: "Right to Object", text: "You may object to the processing of your personal information when the applicable legal conditions for exercising this right are satisfied." },
            { id: "D.", title: "Right to Rectification", text: "You may request the correction of inaccurate or incomplete personal information." },
            { id: "E.", title: "Right to Erasure or Blocking", text: "You may request the suspension, withdrawal, blocking, or removal of personal information when legally justified and subject to applicable retention obligations." },
            { id: "F.", title: "Right to Data Portability", text: "Where applicable, you may request a copy of your personal information in an accessible electronic format under the conditions provided by law." },
            { id: "G.", title: "Right to Damages", text: "You may seek compensation when you suffer damages due to inaccurate, incomplete, outdated, false, unlawfully obtained, or unauthorized use of personal information, subject to applicable law." },
            { id: "H.", title: "Right to File a Complaint", text: "You have the right to file a complaint with the National Privacy Commission if you believe your personal information has been mishandled or your privacy rights have been violated." },
          ],
        },
      ],
    },
    {
      number: "9",
      title: "Contact Information",
      blocks: [
        {
          kind: "paragraph",
          text: "For questions, requests, or concerns about how your personal information is handled, you may contact the authorized school administration or the designated Data Protection Officer.",
        },
        {
          kind: "details",
          items: [
            { label: "Institution", value: "Luis Aguado National High School" },
            { label: "System", value: "LANHS – Student Records and Document Request Management System" },
            { label: "Data Protection Officer", value: "[Insert Authorized DPO Name]" },
            { label: "Official Contact Email", value: "[Insert Official School/DPO Email Address]" },
            { label: "School Address", value: "[Insert Official School Address]" },
          ],
        },
        {
          kind: "paragraph",
          text: "You may also contact the National Privacy Commission through its official website: https://privacy.gov.ph/",
        },
      ],
    },
  ],
  outro: [],
  references: {
    heading: "Legal References and Further Reading",
    items: [
      { text: "Republic Act No. 10173 – Data Privacy Act of 2012.", href: "https://privacy.gov.ph/data-privacy-act/" },
      { text: "Implementing Rules and Regulations of RA 10173.", href: "https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/" },
      { text: "National Privacy Commission – Rights of Data Subjects.", href: "https://privacy.gov.ph/data-subject-rights/" },
      { text: "National Privacy Commission – Data Privacy Guidelines." },
    ],
  },
  footer: documentFooter,
};
