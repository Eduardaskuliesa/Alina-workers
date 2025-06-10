import { DurableObject } from 'cloudflare:workers';

export interface ExpiryData {
	courseId: string;
	userId: string;
	expiresAt: string;
}

export class ExpiryReminder1Day extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async scheduleReminder(expiryData: ExpiryData): Promise<string> {
		await this.ctx.storage.put('expiryData', expiryData);

		const reminderTime = new Date(expiryData.expiresAt).getTime() - (1 * 24 * 60 * 60 * 1000);

		if (reminderTime > Date.now()) {
			await this.ctx.storage.setAlarm(reminderTime);
			console.log(`🔔 1-day reminder scheduled`);
			return `1-day reminder scheduled for course ${expiryData.courseId} for user ${expiryData.userId}`;
		}
		return 'Too late to schedule 1-day reminder';
	}

	async alarm(): Promise<void> {
		const expiryData = await this.ctx.storage.get<ExpiryData>('expiryData');

		if (expiryData) {
			console.log(`📧 Sending 1-day expiry reminder for course ${expiryData.courseId}`);

			const env = this.env as { NEXTJS_APP_URL: string; NEXTJS_APP_API_SECRET: string };

			await fetch(`${env.NEXTJS_APP_URL}/api/send-expiry-reminder`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${env.NEXTJS_APP_API_SECRET}`,
				},
				body: JSON.stringify({
					userId: expiryData.userId,
					courseId: expiryData.courseId,
					daysUntilExpiry: 1,
					reminderType: 'expiry-reminder-1-day',
				}),
			});
		}
	}
}
