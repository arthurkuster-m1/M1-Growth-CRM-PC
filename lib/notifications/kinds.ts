export const NOTIFY_KINDS = {
  message_inbound: { sound: "message", tagPrefix: "msg" },
  alerts_toggle: { sound: "success", tagPrefix: "alerts" },
  lead_new: { sound: "success", tagPrefix: "lead-new" },
  lead_assigned: { sound: "attention", tagPrefix: "lead-assigned" },
  mention: { sound: "attention", tagPrefix: "mention" },
  task: { sound: "attention", tagPrefix: "task" },
  alert: { sound: "attention", tagPrefix: "alert" },
  call_inbound: { sound: "attention", tagPrefix: "call-inbound" },
} as const;

export type NotifyKind = keyof typeof NOTIFY_KINDS;
