export const seedContacts = [
  { id: 1, name: "Sarah Mitchell", company: "TechCorp Inc.", email: "sarah@techcorp.com", phone: "(214) 555-0102", status: "Lead" },
  { id: 2, name: "James Okafor", company: "Delta Solutions", email: "j.okafor@delta.io", phone: "(817) 555-0198", status: "Qualified" },
  { id: 3, name: "Linda Zhao", company: "Novex Partners", email: "lzhao@novex.com", phone: "(972) 555-0173", status: "Proposal" },
];

export const seedDeals = [
  { id: 1, name: "TechCorp Renewal", company: "TechCorp Inc.", value: 18000, stage: "Lead" },
  { id: 2, name: "Delta ERP Setup", company: "Delta Solutions", value: 32000, stage: "Qualified" },
  { id: 3, name: "Novex Analytics", company: "Novex Partners", value: 11500, stage: "Proposal" },
  { id: 4, name: "Apex Onboarding", company: "Apex Ltd.", value: 7500, stage: "Won" },
];

export const seedTasks = [
  { id: 1, title: "Follow up with Sarah Mitchell", due: "Mar 27", done: false },
  { id: 2, title: "Send proposal to Novex", due: "Mar 28", done: false },
  { id: 3, title: "Demo call — Delta Solutions", due: "Mar 29", done: false },
  { id: 4, title: "Update contact info for Apex", due: "Mar 30", done: true },
];

export const seedNotes = [
  { id: 1, text: "Called Sarah — interested in Q2 renewal. Needs pricing deck.", date: "Mar 25, 2026" },
  { id: 2, text: "James confirmed budget approved. Moving to qualified stage.", date: "Mar 24, 2026" },
  { id: 3, text: "Sent intro email to Linda Zhao at Novex.", date: "Mar 23, 2026" },
];
