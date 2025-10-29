import { DurableObject } from 'cloudflare:workers';

export interface ExpiryData {
	courseId: string;
	userId: string;
	expiresAt: string;
}

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

export class ExpiryReminder1Day extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async scheduleReminder(expiryData: ExpiryData): Promise<string> {
		const expiryTime = new Date(expiryData.expiresAt).getTime();
		const reminderTime = expiryTime - ONE_DAY_IN_MS;
		const now = Date.now();

		if (reminderTime <= now) {
			return '❌ Cant schedule reminder in the past';
		}
		const existingAlarm = await this.ctx.storage.getAlarm();
		if (existingAlarm) {
			('⏰ Overiding existing reminder ');
		}
		await this.ctx.storage.put('expiryData', expiryData);

		await this.ctx.storage.setAlarm(reminderTime);

		console.log(`🔔 1-day reminder scheduled`);
		return `1-day reminder scheduled for course ${expiryData.courseId} for user ${expiryData.userId}`;
	}

	async alarm(): Promise<void> {
		console.log('Alarm triggered for 1-day expiry reminder');
		const expiryData = await this.ctx.storage.get<ExpiryData>('expiryData');
		const env = this.env as { NEXTJS_APP_API_SECRET: string; WORKER_URL: string; NEXTJS_APP_URL: string };
		if (expiryData) {
			try {
				console.log(`📧 Sending 1-day expiry reminder for course ${expiryData.courseId}`);
				const response = await fetch(`${env.NEXTJS_APP_URL}/api/send-expiry-reminder`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-worker-origin': `${env.WORKER_URL}`,
						Authorization: `Bearer ${env.NEXTJS_APP_API_SECRET}`,
					},
					body: JSON.stringify({
						userId: expiryData.userId,
						courseId: expiryData.courseId,
						daysUntilExpiry: 1,
						reminderType: 'expiry-reminder-1-day',
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
