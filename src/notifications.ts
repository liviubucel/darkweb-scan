import type { Env, NotificationJob } from "./types";

export async function consumeNotifications(batch: MessageBatch<NotificationJob>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      const job = message.body;
      const destination = await env.DB.prepare("SELECT security_email FROM organizations WHERE id = ?1 AND security_email IS NOT NULL LIMIT 1").bind(job.orgId).first<{ security_email: string }>();
      if (!destination?.security_email) { message.ack(); continue; }
      const alertId = crypto.randomUUID(); const createdAt = new Date().toISOString();
      await env.DB.prepare(`INSERT INTO alerts (id, org_id, investigation_id, type, status, destination, created_at) VALUES (?1, ?2, ?3, ?4, 'sending', ?5, ?6)`).bind(alertId, job.orgId, job.investigationId, job.type, destination.security_email, createdAt).run();
      const result = await env.EMAIL.send({
        to: destination.security_email,
        from: { email: env.EMAIL_FROM, name: "ZebraByte Security" },
        subject: "ZebraByte security intelligence update",
        text: `A ZebraByte threat-intelligence investigation has been updated.\n\nInvestigation: ${job.investigationId}\nEvent: ${job.type}\n\nOpen the ZebraByte portal to review the authenticated findings.`,
      });
      await env.DB.prepare("UPDATE alerts SET status = 'sent', sent_at = ?1 WHERE id = ?2 AND org_id = ?3").bind(new Date().toISOString(), alertId, job.orgId).run();
      void result.messageId; message.ack();
    } catch { message.retry(); }
  }
}
