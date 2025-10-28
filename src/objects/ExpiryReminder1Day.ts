import { DurableObject } from 'cloudflare:workers';

export interface ExpiryData {
	courseId: string;
	userId: string;
	expiresAt: string;
}

const ONE_DAY_IN_MS = 60 * 1000;

export class ExpiryReminder1Day extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async scheduleReminder(expiryData: ExpiryData): Promise<string> {
		await this.ctx.storage.put('expiryData', expiryData);

		const reminderTime = new Date(expiryData.expiresAt).getTime() - ONE_DAY_IN_MS;

		await this.ctx.storage.setAlarm(reminderTime);
		console.log(`🔔 1-day reminder scheduled`);
		return `1-day reminder scheduled for course ${expiryData.courseId} for user ${expiryData.userId}`;
	}

	async alarm(): Promise<void> {
		const expiryData = await this.ctx.storage.get<ExpiryData>('expiryData');
		console.log(expiryData);
		console.log(this.env);
		const env = this.env as { NEXTJS_APP_API_SECRET: string; WORKER_ULR: string };
		if (expiryData) {
			console.log(`📧 Sending 1-day expiry reminder for course ${expiryData.courseId}`);
			await fetch(`http://localhost:3000/api/send-expiry-reminder`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-worker-origin': `${env.WORKER_ULR}`,
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
