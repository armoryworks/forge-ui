import { TrackType, KanbanJob } from '../models/kanban.model';

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const plus4 = new Date(today);
plus4.setDate(today.getDate() + 4);
const plus6 = new Date(today);
plus6.setDate(today.getDate() + 6);
const overdue1 = new Date(today);
overdue1.setDate(today.getDate() - 2);
const overdue2 = new Date(today);
overdue2.setDate(today.getDate() - 3);

function iso(d: Date): string {
  return d.toISOString().split('T')[0];
}

export const MOCK_TRACK_TYPES: TrackType[] = [
  {
    id: 1,
    name: 'Production',
    code: 'production',
    description: 'Standard production workflow from quote to payment',
    isDefault: true,
    sortOrder: 1,
    stages: [
      { id: 1, name: 'Quote Requested', code: 'quote_requested', sortOrder: 1, color: '#94a3b8', wipLimit: null, accountingDocumentType: null, isIrreversible: false },
      { id: 2, name: 'Quoted', code: 'quoted', sortOrder: 2, color: '#0d9488', wipLimit: null, accountingDocumentType: 'Estimate', isIrreversible: false },
      { id: 3, name: 'Order Confirmed', code: 'order_confirmed', sortOrder: 3, color: '#0ea5e9', wipLimit: null, accountingDocumentType: 'SalesOrder', isIrreversible: false },
      { id: 4, name: 'Materials Ordered', code: 'materials_ordered', sortOrder: 4, color: '#8b5cf6', wipLimit: null, accountingDocumentType: 'PurchaseOrder', isIrreversible: false },
      { id: 5, name: 'Materials Received', code: 'materials_received', sortOrder: 5, color: '#a855f7', wipLimit: null, accountingDocumentType: null, isIrreversible: false },
      { id: 6, name: 'In Production', code: 'in_production', sortOrder: 6, color: '#f59e0b', wipLimit: 10, accountingDocumentType: null, isIrreversible: false },
      { id: 7, name: 'QC/Review', code: 'qc_review', sortOrder: 7, color: '#ec4899', wipLimit: 5, accountingDocumentType: null, isIrreversible: false },
      { id: 8, name: 'Shipped', code: 'shipped', sortOrder: 8, color: '#c2410c', wipLimit: null, accountingDocumentType: 'Invoice', isIrreversible: false },
      { id: 9, name: 'Invoiced/Sent', code: 'invoiced_sent', sortOrder: 9, color: '#dc2626', wipLimit: null, accountingDocumentType: 'Invoice', isIrreversible: true },
      { id: 10, name: 'Payment Received', code: 'payment_received', sortOrder: 10, color: '#15803d', wipLimit: null, accountingDocumentType: 'Payment', isIrreversible: true },
    ],
  },
  {
    id: 2,
    name: 'R&D/Tooling',
    code: 'rnd_tooling',
    description: 'Research, development, and tooling projects',
    isDefault: false,
    sortOrder: 2,
    stages: [
      { id: 11, name: 'Concept', code: 'concept', sortOrder: 1, color: '#94a3b8', wipLimit: null, accountingDocumentType: null, isIrreversible: false },
      { id: 12, name: 'Design', code: 'design', sortOrder: 2, color: '#0d9488', wipLimit: null, accountingDocumentType: null, isIrreversible: false },
      { id: 13, name: 'Prototype', code: 'prototype', sortOrder: 3, color: '#0ea5e9', wipLimit: null, accountingDocumentType: null, isIrreversible: false },
      { id: 14, name: 'Test', code: 'test', sortOrder: 4, color: '#f59e0b', wipLimit: null, accountingDocumentType: null, isIrreversible: false },
      { id: 15, name: 'Iterate', code: 'iterate', sortOrder: 5, color: '#ec4899', wipLimit: null, accountingDocumentType: null, isIrreversible: false },
      { id: 16, name: 'Production Ready', code: 'production_ready', sortOrder: 6, color: '#15803d', wipLimit: null, accountingDocumentType: null, isIrreversible: false },
    ],
  },
  {
    id: 3,
    name: 'Maintenance',
    code: 'maintenance',
    description: 'Equipment and facility maintenance requests',
    isDefault: false,
    sortOrder: 3,
    stages: [
      { id: 17, name: 'Requested', code: 'requested', sortOrder: 1, color: '#94a3b8', wipLimit: null, accountingDocumentType: null, isIrreversible: false },
      { id: 18, name: 'Scheduled', code: 'scheduled', sortOrder: 2, color: '#0ea5e9', wipLimit: null, accountingDocumentType: null, isIrreversible: false },
      { id: 19, name: 'In Progress', code: 'in_progress', sortOrder: 3, color: '#f59e0b', wipLimit: null, accountingDocumentType: null, isIrreversible: false },
      { id: 20, name: 'Complete', code: 'complete', sortOrder: 4, color: '#15803d', wipLimit: null, accountingDocumentType: null, isIrreversible: false },
    ],
  },
];

export const MOCK_JOBS: KanbanJob[] = [
  // Quote Requested
  { id: 50, jobNumber: 'J-1050', title: 'Custom bracket quote — Meridian', stageName: 'Quote Requested', stageColor: '#94a3b8', assigneeInitials: null, assigneeColor: null, priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Meridian Systems' },

  // Quoted
  { id: 51, jobNumber: 'J-1051', title: 'Prototype enclosure estimate', stageName: 'Quoted', stageColor: '#0d9488', assigneeInitials: 'AK', assigneeColor: '#0d9488', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Quantum Dynamics' },
  { id: 52, jobNumber: 'J-1052', title: 'Gear assembly RFQ', stageName: 'Quoted', stageColor: '#0d9488', assigneeInitials: null, assigneeColor: null, priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Apex Manufacturing' },

  // Order Confirmed
  { id: 53, jobNumber: 'J-1053', title: 'Precision shaft order — Acme', stageName: 'Order Confirmed', stageColor: '#0ea5e9', assigneeInitials: 'AK', assigneeColor: '#0d9488', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Acme Corp' },
  { id: 54, jobNumber: 'J-1054', title: 'Bracket assembly order — Quantum', stageName: 'Order Confirmed', stageColor: '#0ea5e9', assigneeInitials: 'DH', assigneeColor: '#7c3aed', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Quantum Dynamics' },
  { id: 55, jobNumber: 'J-1055', title: 'Fixture plate order — Apex', stageName: 'Order Confirmed', stageColor: '#0ea5e9', assigneeInitials: 'JS', assigneeColor: '#c2410c', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Apex Manufacturing' },
  { id: 56, jobNumber: 'J-1056', title: 'Manifold block order — Meridian', stageName: 'Order Confirmed', stageColor: '#0ea5e9', assigneeInitials: 'MR', assigneeColor: '#15803d', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Meridian Systems' },
  { id: 57, jobNumber: 'J-1057', title: 'Dowel pin set order — Acme', stageName: 'Order Confirmed', stageColor: '#0ea5e9', assigneeInitials: 'AK', assigneeColor: '#0d9488', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Acme Corp' },

  // Materials Ordered
  { id: 44, jobNumber: 'J-1044', title: 'Anodize prep — Heat Sink Array', stageName: 'Materials Ordered', stageColor: '#8b5cf6', assigneeInitials: 'JS', assigneeColor: '#c2410c', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Quantum Dynamics' },
  { id: 58, jobNumber: 'J-1058', title: 'Material sourcing — Titanium rod stock', stageName: 'Materials Ordered', stageColor: '#8b5cf6', assigneeInitials: 'JS', assigneeColor: '#c2410c', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Quantum Dynamics' },

  // Materials Received
  { id: 38, jobNumber: 'J-1038', title: 'Material prep — Shaft Housing', stageName: 'Materials Received', stageColor: '#a855f7', assigneeInitials: 'DH', assigneeColor: '#7c3aed', priorityName: 'Normal', dueDate: iso(plus4), isOverdue: false, customerName: 'Quantum Dynamics' },
  { id: 59, jobNumber: 'J-1059', title: 'Stock inspection — Aluminum billet', stageName: 'Materials Received', stageColor: '#a855f7', assigneeInitials: 'DH', assigneeColor: '#7c3aed', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Apex Manufacturing' },

  // In Production
  { id: 42, jobNumber: 'J-1042', title: 'CNC setup — Bracket Assy Rev C', stageName: 'In Production', stageColor: '#f59e0b', assigneeInitials: 'AK', assigneeColor: '#0d9488', priorityName: 'Normal', dueDate: iso(tomorrow), isOverdue: false, customerName: 'Apex Manufacturing' },
  { id: 41, jobNumber: 'J-1041', title: 'Weld fixture alignment check', stageName: 'In Production', stageColor: '#f59e0b', assigneeInitials: 'MR', assigneeColor: '#15803d', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Meridian Systems' },
  { id: 39, jobNumber: 'J-1039', title: 'Program verify — Plate Adapter', stageName: 'In Production', stageColor: '#f59e0b', assigneeInitials: 'AK', assigneeColor: '#0d9488', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Apex Manufacturing' },
  { id: 33, jobNumber: 'J-1033', title: 'Deburr & finish — Gear Blank', stageName: 'In Production', stageColor: '#f59e0b', assigneeInitials: 'DH', assigneeColor: '#7c3aed', priorityName: 'High', dueDate: iso(overdue1), isOverdue: true, customerName: 'Quantum Dynamics' },
  { id: 36, jobNumber: 'J-1036', title: 'Assembly — Pneumatic Manifold', stageName: 'In Production', stageColor: '#f59e0b', assigneeInitials: 'AK', assigneeColor: '#0d9488', priorityName: 'Normal', dueDate: iso(plus6), isOverdue: false, customerName: 'Meridian Systems' },
  { id: 37, jobNumber: 'J-1037', title: 'Surface grind — Dowel Plate', stageName: 'In Production', stageColor: '#f59e0b', assigneeInitials: 'DH', assigneeColor: '#7c3aed', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Apex Manufacturing' },
  { id: 45, jobNumber: 'J-1045', title: 'Drill & tap — Mounting Block', stageName: 'In Production', stageColor: '#f59e0b', assigneeInitials: 'MR', assigneeColor: '#15803d', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Meridian Systems' },
  { id: 46, jobNumber: 'J-1046', title: 'EDM programming — Die Insert', stageName: 'In Production', stageColor: '#f59e0b', assigneeInitials: 'AK', assigneeColor: '#0d9488', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Acme Corp' },
  { id: 34, jobNumber: 'J-1034', title: 'Laser mark — Serial plates (50pc)', stageName: 'In Production', stageColor: '#f59e0b', assigneeInitials: 'DH', assigneeColor: '#7c3aed', priorityName: 'High', dueDate: iso(overdue2), isOverdue: true, customerName: 'Quantum Dynamics' },
  { id: 47, jobNumber: 'J-1047', title: 'Wire EDM — Punch Tool blank', stageName: 'In Production', stageColor: '#f59e0b', assigneeInitials: 'AK', assigneeColor: '#0d9488', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Apex Manufacturing' },
  { id: 48, jobNumber: 'J-1048', title: 'Tumble finish — Small parts lot', stageName: 'In Production', stageColor: '#f59e0b', assigneeInitials: 'DH', assigneeColor: '#7c3aed', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Meridian Systems' },

  // QC/Review
  { id: 35, jobNumber: 'J-1035', title: 'QC inspection — Motor Mount v2', stageName: 'QC/Review', stageColor: '#ec4899', assigneeInitials: 'JS', assigneeColor: '#c2410c', priorityName: 'Normal', dueDate: iso(today), isOverdue: false, customerName: 'Acme Corp' },
  { id: 40, jobNumber: 'J-1040', title: 'First article inspection — Flange', stageName: 'QC/Review', stageColor: '#ec4899', assigneeInitials: 'MR', assigneeColor: '#15803d', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Acme Corp' },
  { id: 30, jobNumber: 'J-1030', title: 'Final QC — Hydraulic valve body', stageName: 'QC/Review', stageColor: '#ec4899', assigneeInitials: 'JS', assigneeColor: '#c2410c', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Acme Corp' },

  // Shipped
  { id: 31, jobNumber: 'J-1031', title: 'Acme Order — Pack & ship', stageName: 'Shipped', stageColor: '#c2410c', assigneeInitials: 'MR', assigneeColor: '#15803d', priorityName: 'High', dueDate: iso(today), isOverdue: false, customerName: 'Acme Corp' },
  { id: 60, jobNumber: 'J-1060', title: 'Quantum shipment — Bearing housings', stageName: 'Shipped', stageColor: '#c2410c', assigneeInitials: 'MR', assigneeColor: '#15803d', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Quantum Dynamics' },

  // Invoiced/Sent (alternating with Payment Received)
  { id: 20, jobNumber: 'J-1020', title: 'Completed — Jig assembly', stageName: 'Invoiced/Sent', stageColor: '#dc2626', assigneeInitials: 'AK', assigneeColor: '#0d9488', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Acme Corp' },
  { id: 22, jobNumber: 'J-1022', title: 'Completed — Custom fastener lot', stageName: 'Invoiced/Sent', stageColor: '#dc2626', assigneeInitials: 'DH', assigneeColor: '#7c3aed', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Apex Manufacturing' },
  { id: 24, jobNumber: 'J-1024', title: 'Completed — Bearing retainer', stageName: 'Invoiced/Sent', stageColor: '#dc2626', assigneeInitials: 'JS', assigneeColor: '#c2410c', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Quantum Dynamics' },
  { id: 26, jobNumber: 'J-1026', title: 'Completed — Alignment tool', stageName: 'Invoiced/Sent', stageColor: '#dc2626', assigneeInitials: 'MR', assigneeColor: '#15803d', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Meridian Systems' },

  // Payment Received (alternating)
  { id: 21, jobNumber: 'J-1021', title: 'Paid — Spindle repair', stageName: 'Payment Received', stageColor: '#15803d', assigneeInitials: 'DH', assigneeColor: '#7c3aed', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Quantum Dynamics' },
  { id: 23, jobNumber: 'J-1023', title: 'Paid — Motor bracket batch', stageName: 'Payment Received', stageColor: '#15803d', assigneeInitials: 'AK', assigneeColor: '#0d9488', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Meridian Systems' },
  { id: 25, jobNumber: 'J-1025', title: 'Paid — Drill fixture set', stageName: 'Payment Received', stageColor: '#15803d', assigneeInitials: 'MR', assigneeColor: '#15803d', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Acme Corp' },
  { id: 27, jobNumber: 'J-1027', title: 'Paid — Prototype housing', stageName: 'Payment Received', stageColor: '#15803d', assigneeInitials: 'JS', assigneeColor: '#c2410c', priorityName: 'Normal', dueDate: null, isOverdue: false, customerName: 'Apex Manufacturing' },
];
