/** regulatory-watchtower: optional apply payload — a due date + target Event-Type turn the
 *  proposal into a system-generated compliance-calendar deadline on confirm. */
export interface ApplyProposalRequest {
  dueDate: string | null;
  targetEventTypeId: number | null;
}
