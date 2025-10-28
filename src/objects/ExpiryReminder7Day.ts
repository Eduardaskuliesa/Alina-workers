import { DurableObject } from 'cloudflare:workers';

export interface ExpiryData {
	courseId: string;
	userId: string;
	expiresAt: string;
}

const SEVEN_DAYS_IN_MS = 7 * 24 * 60 * 60 * 1000;

export class ExpiryReminder7Day extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async scheduleReminder(expiryData: ExpiryData): Promise<string> {
		const expiryTime = new Date(expiryData.expiresAt).getTime();
		const reminderTime = expiryTime - SEVEN_DAYS_IN_MS;
		const now = Date.now();

		if (reminderTime <= now) {
			return '❌ Cant schedule reminder in the past';
		}

		const existingAlarm = await this.ctx.storage.getAlarm();
		if (existingAlarm) {
			return '⏰ Overiding existing reminder ';
		}

		await this.ctx.storage.put('expiryData', expiryData);
		await this.ctx.storage.setAlarm(reminderTime);

		console.log(`🔔 7-day reminder scheduled`);
		return `7-day reminder scheduled for course ${expiryData.courseId} for user ${expiryData.userId}`;
	}

	async alarm(): Promise<void> {
		const expiryData = await this.ctx.storage.get<ExpiryData>('expiryData');
		const env = this.env as { NEXTJS_APP_URL: string; NEXTJS_APP_API_SECRET: string; WORKER_URL: string };
		if (expiryData) {
			try {
				console.log(`📧 Sending 7-day expiry reminder for course ${expiryData.courseId}`);
				const response = await fetch(`${env.NEXTJS_APP_URL}/api/send-expiry-reminder`, {
					method: 'POST',
					headers: {
						'x-worker-origin': `${env.WORKER_URL}`,
						'Content-Type': 'application/json',
						Authorization: `Bearer ${env.NEXTJS_APP_API_SECRET}`,
					},
					body: JSON.stringify({
						userId: expiryData.userId,
						courseId: expiryData.courseId,
						daysUntilExpiry: 7,
						reminderType: 'expiry-reminder-7-day',
					}),
				});
				if (response.ok) {
					await this.ctx.storage.delete('expiryData');
					console.log('✅ Reminder sent and data cleaned up');
				}
				if (!response.ok) {
					console.error('❌ Failed to send reminder:', response.status);
				}
			} catch (error) {
				console.error('Error sending reminder:', error);
				throw error;
			}
		}
	}
}
