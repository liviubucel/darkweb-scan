import type { Env, NotificationJob } from "./types";

function notificationCopy(job: NotificationJob): { subject: string; text: string } {
  if (job.type === "exposure.detected") {
    const artifacts = Math.max(0, job.newArtifactCount ?? 0);
    const sources = Math.max(0, job.newSourceCount ?? 0);
    return {
      subject: "ZebraByte exposure detected",
      text: `ZebraByte continuous monitoring detected new exposure evidence.\n\nInvestigation: ${job.investigationId}\nNew artifacts: ${artifacts}\nNew sources: ${sources}\n\nOpen the ZebraByte portal to review the authenticated findings.`,
    };
  }
  if (job.type === "monitoring.baseline") {
    return {
      subject: "ZebraByte monitoring baseline established",
      text: `The first monitoring investigation has completed and established a baseline. No change alert is generated from the baseline itself.\n\nInvestigation: ${job.investigationId}\n\nFuture monitoring runs will be compared against previous completed evidence.`,
    };
  }
  if (job.type === "investigation.failed") {
    return {
      subject: "ZebraByte investigation failed",
      text: `A ZebraByte threat-intelligence investigation could not be completed.\n\nInvestigation: ${job.investigationId}\n\nOpen the ZebraByte portal to review its status and retry if appropriate.`,
    };
  }
  return {
    subject: "ZebraByte investigation completed",
    text: `A ZebraByte threat-intelligence investigation has completed.\n\nInvestigation: ${job.investigationId}\n\nOpen the ZebraByte portal to review the authenticated findings.`,
  };
}

function alertId(job: NotificationJob): string {
  return `${job.investigationId}:${job.type}`;
}

export async function consumeNotifications(batch: MessageBatch<NotificationJob>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      const job = message.body;
      if (!job?.orgId || !job.investigationId || !job.type) { message.ack(); continue; }

      const destination = job.recipient
        ? { security_email: job.recipient }
        : await env.DB.prepare("SELECT security_email FROM organizations WHERE id = ?1 AND security_email IS NOT NULL LIMIT 1").bind(job.orgId).first<{ security_email: string }>();
      if (!destination?.security_email) { message.ack(); continue; }

      const id = alertId(job);
      const existing = await env.DB.prepare("SELECT status FROM alerts WHERE id = ?1 AND org_id = ?2 LIMIT 1").bind(id, job.orgId).first<{ status: string }>();
      if (existing?.status === "sent") { message.ack(); continue; }

      const createdAt = new Date().toISOString();
      await env.DB.prepare(`INSERT INTO alerts (id, org_id, investigation_id, type, status, destination, created_at) VALUES (?1, ?2, ?3, ?4, 'sending', ?5, ?6) ON CONFLICT(id) DO UPDATE SET status = 'sending', destination = excluded.destination`).bind(id, job.orgId, job.investigationId, job.type, destination.security_email, createdAt).run();

      const copy = notificationCopy(job);
      const result = await env.EMAIL.send({
        to: destination.security_email,
        from: { email: env.EMAIL_FROM, name: "ZebraByte Security" },
        subject: copy.subject,
        text: copy.text,
      });
      await env.DB.prepare("UPDATE alerts SET status = 'sent', sent_at = ?1 WHERE id = ?2 AND org_id = ?3").bind(new Date().toISOString(), id, job.orgId).run();
      void result.messageId;
      message.ack();
    } catch {
      message.retry();
    }
  }
}
