import { DurableObject } from 'cloudflare:workers';

export interface CartItem {
	courseId: string;
	slug: string;
	title: string;
	userId: string;
	price: number;
	language: string;
	imageUrl: string;
	duration: number;
	lessonCount: number;
	accessDuration: number;
	accessPlanId: string;
	isFromPrice?: boolean;
}

const FOUR_HOURS_IN_MS = 2 * 1000;
const CART_REMINDER_COLDOWN_TIME_IN_S = 60;

export class Cart extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}
	private async _resetCartReminder(): Promise<void> {
		const cartItems: CartItem[] = (await this.ctx.storage.get<CartItem[]>('cartItems')) || [];

		if (cartItems.length > 0) {
			const reminderTime = Date.now() + FOUR_HOURS_IN_MS;
			await this.ctx.storage.setAlarm(reminderTime);
			await this.ctx.storage.put('reminderScheduled', true);
			console.log('🔔 Cart reminder scheduled');
		} else {
			await this.ctx.storage.deleteAlarm();
			await this.ctx.storage.put('reminderScheduled', false);
			console.log('Cart reminder cancelled - empty cart ❌');
		}
	}

	private async _notifyNextJsApp(cartItems: CartItem[]): Promise<void> {
		try {
			const env = this.env as {
				NEXTJS_APP_URL: string;
				NEXTJS_APP_API_SECRET: string;
				WORKER_URL: string;
				CART_REMINDER_COOLDOWN: KVNamespace;
			};
			const userId = cartItems.length > 0 ? cartItems[0].userId : null;
			const response = await fetch(`${env.NEXTJS_APP_URL}/api/send-cart-reminder`, {
				method: 'POST',
				headers: {
					'x-worker-origin': `${env.WORKER_URL}`,
					'Content-Type': 'application/json',
					Authorization: `Bearer ${env.NEXTJS_APP_API_SECRET}`,
				},
				body: JSON.stringify({
					cartItems: cartItems,
					userId: userId,
					reminderType: 'cart-abandonment',
				}),
			});

			if (response.ok) {
				const key = `cart-reminder-is-on-cooldown-${userId}`;
				await env.CART_REMINDER_COOLDOWN.put(userId!, key, { expirationTtl: CART_REMINDER_COLDOWN_TIME_IN_S });
				console.log('✅ Cart reminder sent to Next.js successfully');
			} else {
				console.error('❌ Failed to notify Next.js:', response.status);
			}
		} catch (error) {
			console.error('❌ Error calling Next.js API:', error);
		}
	}

	async resetCartReminder(): Promise<string> {
		await this._resetCartReminder();
		const cartItems: CartItem[] = (await this.ctx.storage.get<CartItem[]>('cartItems')) || [];
		if (cartItems.length > 0) {
			return 'Cart reminder reset to 24 hours';
		} else {
			return 'No items in cart, reminder not set';
		}
	}

	async addToCart(item: CartItem): Promise<string> {
		const cartItems: CartItem[] = (await this.ctx.storage.get<CartItem[]>('cartItems')) || [];
		console.log('Cart items before adding:', cartItems.length);
		const exist = cartItems.find((cartItems) => cartItems.courseId === item.courseId);
		if (exist) {
			return `Item already exists in the cart`;
		}

		cartItems.push(item);
		await this.ctx.storage.put('cartItems', cartItems);
		console.log('Cart items after adding:', cartItems.length);

		await this._resetCartReminder();

		return `Item ${item.title} added to cart successfully`;
	}

	async removeFromCart(courseId: string): Promise<string> {
		const cartItems: CartItem[] = (await this.ctx.storage.get<CartItem[]>('cartItems')) || [];
		console.log('Cart items before removal:', cartItems.length);
		const update = cartItems.filter((item) => item.courseId !== courseId);

		await this.ctx.storage.put('cartItems', update);
		console.log('Cart items after removal:', update.length);

		await this._resetCartReminder();

		return 'Item removed from cart';
	}

	async updateCart(courseId: string, updates: Partial<CartItem>): Promise<string> {
		const cartItems: CartItem[] = (await this.ctx.storage.get<CartItem[]>('cartItems')) || [];

		const item = cartItems.find((cartItem) => cartItem.courseId === courseId);
		console.log('Old cart Item:', item);
		if (item) {
			Object.assign(item, updates);
			console.log('Updated cart Item:', item);
			await this.ctx.storage.put('cartItems', cartItems);

			await this._resetCartReminder();

			return `Item ${courseId} updated successfully`;
		}

		return `Item ${courseId} not found in cart`;
	}

	async getCart(): Promise<CartItem[]> {
		const cartItems: CartItem[] = (await this.ctx.storage.get<CartItem[]>('cartItems')) || [];
		console.log('Cart items retrieved:', cartItems.length);
		return cartItems;
	}

	async clearCart(): Promise<string> {
		await this.ctx.storage.put('cartItems', []);
		const cartItems: CartItem[] = (await this.ctx.storage.get<CartItem[]>('cartItems')) || [];
		console.log('Cart items after clearing:', cartItems.length);
		await this._resetCartReminder();

		return 'Cart cleared successfully';
	}

	async alarm(): Promise<void> {
		console.log('🔔 Cart reminder alarm triggered!');
		const env = this.env as { CART_REMINDER_COOLDOWN: KVNamespace };

		const cartItems: CartItem[] = (await this.ctx.storage.get<CartItem[]>('cartItems')) || [];
		const reminderScheduled = (await this.ctx.storage.get('reminderScheduled')) || false;
		const userId = cartItems.length > 0 ? cartItems[0].userId : null;

		const cooldown = await env.CART_REMINDER_COOLDOWN.get(userId!);
		console.log(cooldown);

		if (cartItems.length > 0 && reminderScheduled && cooldown === null) {
			console.log('🔔 Cart reminder alarm proccesing!');
			await this._notifyNextJsApp(cartItems);
		}
		await this.ctx.storage.put('reminderScheduled', false);
	}
}
